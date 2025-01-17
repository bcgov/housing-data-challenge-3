import React from 'react';
import Constants from '../constants';
import MapLegend from './map-legend.js';

import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';

require('leaflet.vectorgrid/dist/Leaflet.VectorGrid.bundled.min.js');
require('drmonty-leaflet-awesome-markers/js/leaflet.awesome-markers.min.js');
require('drmonty-leaflet-awesome-markers/css/leaflet.awesome-markers.css');

/*

MapViz component
================

Essentially a component that wraps a Leaflet map. Assumes the use of VectorGrid
tiles (https://github.com/Leaflet/Leaflet.VectorGrid).

Will accept a single `activeBoundaryLayer` object (as generated by the
`DataBoundaries` component and passed through `MapGraphDisplay`), and a
dictionary of `activeLayers` (as generated by the `DataLayers` component and
passed through `MapGraphDisplay`). For more on the defined shapes of these
objects, see the propTypes definition at the end of this file.

*/
class MapViz extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            activeBoundaryLayer: null,
            activeLayers: {},
            highlightedItem: {
                name: '',
                id: ''
            }
        };

        this.highlightFeature = this.highlightFeature.bind(this);
        this.resetHighlight = this.resetHighlight.bind(this);
        this.clickFeature = this.clickFeature.bind(this);
        // this.getCurrentlyVisibleFeatureById = this.getCurrentlyVisibleFeatureById.bind(this);
    }

    invalidateSize() {
        this.map.invalidateSize();
    }

    panToLatLng(lat, lng, zoomLevel, featureId) {
        if (zoomLevel) {
            this.map.setView([lat, lng], zoomLevel);
        } else {
            this.map.panTo([lat, lng]);
        }
        setTimeout(this.getCurrentlyVisibleFeatureById, 1000, featureId);

        // TODO: the animation is nice, but tile loading makes it ugly :-(
        // this.map.flyTo([lat, lng], zoomLevel);
    }

    getFeatureId(feature) {
        return feature.properties[this.state.activeBoundaryLayer.boundaryInfo.featureIdProperty];
    }

    getTileStyles(properties, zoom, id) {
        const featureId = id || properties[this.state.activeBoundaryLayer.boundaryInfo.featureIdProperty];
        let styles = Object.assign({}, Constants.MAP_BASE_FEATURE_STYLES);

        if (this.props.boundaryData.dataDictionary && this.props.boundaryData.dataDictionary[featureId]) {
            styles.fillColor = this.props.boundaryData.dataDictionary[featureId].color;
        }

        if (zoom < 12) {
            styles.weight = 0;
        }

        return styles;
    }

    highlightFeature(event, id, name) {

        const activeBoundaryLayerInfo = this.state.activeBoundaryLayer.boundaryInfo;

        const featureId = id || event.layer.properties[activeBoundaryLayerInfo.featureIdProperty];
        const featureName = name || event.layer.properties[activeBoundaryLayerInfo.featureNameProperty];

        let style = this.getTileStyles(null, null, featureId);
        style.fillOpacity = 0.9;
        style.weight = 2;
        this.state.activeBoundaryLayer.setFeatureStyle(featureId, style);

        this.props.highlightedItemCallback({ name: featureName, id: featureId });
    }

    resetHighlight(event) {
        let id = event.layer.properties[this.state.activeBoundaryLayer.boundaryInfo.featureIdProperty];
        event.target.resetFeatureStyle(id);
        // this.props.highlightedItemCallback({ name: '', id: '', });
    }

    clickFeature(event) {
        this.resetHighlight(event);
        this.highlightFeature(event);
        this.panToLatLng(event.latlng.lat, event.latlng.lng);
    }

    buildBoundaryLayer(boundaryInfo) {
        let vectorTileOptions = {
            bounds: Constants.MAP_INITIAL_BOUNDS,
            vectorTileLayerStyles: {},
            getFeatureId: this.getFeatureId.bind(this),
            interactive: true
        };
        vectorTileOptions.vectorTileLayerStyles[boundaryInfo.layerName] = this.getTileStyles.bind(this);

        const boundaryLayer = L.vectorGrid.protobuf(
            boundaryInfo.url,
            vectorTileOptions
        );

        boundaryLayer.on('mouseover', this.highlightFeature);
        boundaryLayer.on('mouseout', this.resetHighlight);
        boundaryLayer.on('click', this.clickFeature);
        boundaryLayer.boundaryInfo = boundaryInfo;

        return boundaryLayer;
    }

    componentDidMount() {
        // Listen for the 'shown' event, fired by the TabInterface
        window.addEventListener('shown', this.invalidateSize.bind(this));

        this.map = L.map(this.mapDiv, { minZoom: Constants.MAP_MIN_ZOOM, maxZoom: Constants.MAP_MAX_ZOOM });
        this.map.setView(Constants.MAP_INITIAL_CENTER, Constants.MAP_INITIAL_ZOOM);

        this.baseLayer = L.tileLayer(
            Constants.MAP_BASE_LAYER_URL, {
                attribution: Constants.MAP_BASE_LAYER_ATTRIBUTION
            }
        );
        this.baseLayer.addTo(this.map);

        const osmProvider = new OpenStreetMapProvider({
            params: {
                countrycodes: 'ca',
                viewbox: ['-139.052201', '60.000062', '-114.054221', '48.308916'],
                bounded: 1
            }
        });

        this.searchControl = new GeoSearchControl({
            provider: osmProvider,
            position: 'topleft',
            style: 'bar',
            autoComplete: false,
            showMarker: false,
        }).addTo(this.map);

        (function () {
            var control = new L.Control({ position: 'topleft' });
            control.onAdd = function (map) {
                var resetButton = L.DomUtil.create('div', 'leaflet-control-zoom');
                resetButton.innerHTML =
                    `<button id="btn-reset" class="btn btn-default btn-xs" style="width: 25px; height: 25px;" aria-label="Reset">
                        <i class="fa fa-undo"></i>
                    </button>`;
                L.DomEvent.addListener(resetButton, 'click', function () {
                    map.setView(Constants.MAP_INITIAL_CENTER, Constants.MAP_INITIAL_ZOOM);
                }, resetButton);
                return resetButton;
            };
            return control;
        }()).addTo(this.map);

        this.boundaryLayers = {};
        this.layerGroups = {};
        let labeledBoundaryLayers = {};

        Object.keys(Constants.MAP_BOUNDARY_INFO).forEach(function (key) {
            const boundaryInfo = Constants.MAP_BOUNDARY_INFO[key];
            const boundaryLayer = this.buildBoundaryLayer.bind(this)(boundaryInfo);
            this.boundaryLayers[key] = boundaryLayer;
            labeledBoundaryLayers[boundaryInfo.label] = boundaryLayer;
        }, this);
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps.boundaryData != this.props.boundaryData) {
            this.updateBoundaries(prevProps, prevState);
        }
        if (prevProps.layerData != this.props.layerData) {
            this.updateLayers(prevProps, prevState);
        }
    }

    updateBoundaries(prevProps, prevState) {
        const previousBoundaryLayer = prevState.activeBoundaryLayer;

        const boundaryLayerType = this.props.boundaryData.dataSource.geographyType;
        const boundaryLayer = this.boundaryLayers[boundaryLayerType];

        this.setState({activeBoundaryLayer: boundaryLayer });

        // Load a new layer
        if (previousBoundaryLayer && previousBoundaryLayer.boundaryInfo.layerName != boundaryLayer.boundaryInfo.layerName) {
            this.map.removeLayer(previousBoundaryLayer);
            this.map.addLayer(boundaryLayer);
        } else if (!previousBoundaryLayer) {
            this.map.addLayer(boundaryLayer);
        }

        // Refresh all the feature styles after receiving feature data.
        // Find all affected feature IDs
        let ids = [];
        this.map.eachLayer(function (layer) {
            if (layer.setFeatureStyle) {
                for (let tileId in layer._vectorTiles) {
                    let tile = layer._vectorTiles[tileId];
                    for (let featureId in tile._features) {
                        let feature = tile._features[featureId];
                        let id = feature.feature.properties[boundaryLayer.boundaryInfo.featureIdProperty];
                        ids.push(id);
                    }
                }
            }
        }.bind(this));

        // Get unique IDs
        let uniqueIds = Constants.getUniqueValues(ids);

        // Reset the feature style for all the unique IDs
        for (let id of uniqueIds) {
            boundaryLayer.resetFeatureStyle(id);
        }
    }

    updateLayers(prevProps, prevState) {

        // First, remove local layers that no longer appear in the props
        for (var layerGroupKey in this.layerGroups) {
            if (!this.props.layerData[layerGroupKey]) {
                this.map.removeLayer(this.layerGroups[layerGroupKey]);
                delete (this.layerGroups[layerGroupKey]);
            }
        }

        // Next, add layers that are in the props and not in the local layers
        for (var key in this.props.layerData) {
            var layerData = this.props.layerData[key];
            if (this.layerGroups[key]) {
                continue;
            } else {
                const geographyType = layerData.dataSource.geographyType;
                const layerGroupArray = [];
                const markerIcon = L.AwesomeMarkers.icon({
                    prefix: 'fa',
                    icon: layerData.dataSource.icon,
                    markerColor: layerData.dataSource.iconColor
                });
                const geoJSONStyle = {
                    color: '#00cad6',
                    weight: 2,
                    opacity: 1
                };
                layerData.data.forEach(layerItem => {
                    switch (geographyType) {
                        case 'latlon':
                            // A single point -- add a marker
                            var marker = L.marker(layerItem.geography, {icon: markerIcon }).bindPopup(layerItem.value);
                            layerGroupArray.push(marker);
                            break;
                        case 'feature':
                            // A feature (e.g. line, polygon) in geoJSON
                            var geoJSON = L.geoJSON(layerItem.geography, geoJSONStyle);
                            layerGroupArray.push(geoJSON);
                            break;
                    }
                });
                const layerGroup = L.layerGroup(layerGroupArray);
                this.layerGroups[key] = layerGroup;
                this.map.addLayer(layerGroup);
            }
        }
    }

    componentWillUnmount() {
        this.map = null;
    }

    render() {
        let scaleColors = [];
        let scaleQuantiles = [];

        if (this.props.boundaryData) {
            scaleColors = this.props.boundaryData.scaleColors;
            scaleQuantiles = this.props.boundaryData.scaleQuantiles;
        }

        return (
            <div>
                <div
                    id="my-map"
                    ref={(div) => this.mapDiv = div} >
                </div>
                <MapLegend
                    scaleColors={scaleColors}
                    scaleQuantiles={scaleQuantiles} />
            </div>
        );
    }
}

MapViz.propTypes = {
    highlightedItemCallback: React.PropTypes.func,
    boundaryData: React.PropTypes.shape({
        dataSource: React.PropTypes.object.isRequired,
        dataDictionary: React.PropTypes.object.isRequired,
        scaleColors: React.PropTypes.array.isRequired,
        scaleQuantiles: React.PropTypes.array.isRequired
    }).isRequired,
    layerData: React.PropTypes.objectOf(
        React.PropTypes.shape({
            dataSource: React.PropTypes.object.isRequired,
            data: React.PropTypes.array.isRequired
        })
    ).isRequired
};
module.exports = MapViz;
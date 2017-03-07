import React from 'react';
import Constants from '../constants';

class RankGraph extends React.Component {

    constructor(props) {
        super(props);

        this.HEIGHT = 50;
        this.WIDTH = 200;
    }

    componentDidMount() {
        this.buildGraphic();
    }

    componentDidUpdate(prevProps, prevState) {
        if (!prevProps.data[0] || prevProps.data[0].value != this.props.data[0].value) {
            this.updateGraphic();
        }
        if (prevProps.highlightedId != this.props.highlightedId) {
            this.updateHighlight();
        }
    }

    buildGraphic() {
        let svg = d3.select(this.rankGraph);

        let g = svg.append('g')
            .attr('class', 'parent')
            .attr('transform', 'translate(' + 0 + ',' + 0 + ')');

        g.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0,' + this.HEIGHT + ')');

        g.append('g')
            .attr('class', 'y axis');

        this.updateGraphic();
    }

    updateGraphic() {

        var data = this.props.data;

        if (data.length) {

            let g = d3.select(this.rankGraph).select('g.parent');

            data = data.filter((d) => (!isNaN(d.value) && isFinite(d.value)));
            data = data.sort((a, b) => a.value - b.value);

            let x = d3.scaleBand().range([0, this.WIDTH]);
            let y = d3.scaleLinear().range([this.HEIGHT, 0]);

            x.domain(data.map((d) => d.id));
            y.domain([0, d3.max(data, (d) => d.value )]);

            g.selectAll('.bar').remove();

            let bars = g.selectAll('.bar')
                    .data(data)
                .enter().append('rect')
                    .attr('class', (d) => 'bar data-' + d.id)
                    .attr('x', (d) => x(d.id))
                    .attr('width', x.bandwidth())
                    .attr('y', (d) => y(d.value))
                    .attr('height', (d) => this.HEIGHT - y(d.value))
                    .attr('fill', this.props.grayscale ? 'grey': (d) => d.color)
                    .attr('opacity', 0.5);
        }
    }

    updateHighlight() {
        let g = d3.select(this.rankGraph).select('g.parent');

        g.selectAll('rect.bar')
            .attr('fill', this.props.grayscale ? 'grey': (d) => d.color)
            .attr('opacity', 0.5);

        g.selectAll('rect.bar.data-' + this.props.highlightedId)
                .attr('fill', 'black')
                .attr('opacity', 1.0);
    }

    render() {
        let highlightedValue = '';
        if (this.props.data) {
            let highlightedItem = this.props.data.filter((item) => item.id === +this.props.highlightedId);
            if (highlightedItem.length) {
                highlightedValue = highlightedItem[0].value;
            }
        }

        return (
            <div className="rank-graph">
                <h4>{this.props.title} <small>{Constants.formatNumber(highlightedValue)}</small></h4>
                <svg
                    ref={(rankGraph) => { this.rankGraph = rankGraph; }}>
                </svg>
            </div>
        );
    }
}

RankGraph.propTypes = {
    title: React.PropTypes.string.isRequired,
    grayscale: React.PropTypes.bool,
    data: React.PropTypes.arrayOf(React.PropTypes.shape({
        id: React.PropTypes.any,
        value: React.PropTypes.number
    })).isRequired,
    highlightedId: React.PropTypes.any
};

module.exports = RankGraph;
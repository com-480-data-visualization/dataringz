<template>
    <div ref="chartContainer" class="w-full h-full max-w-full max-h-full overflow-hidden"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';
import * as d3 from 'd3';
import athletes from '~/data/athletes.json';

const props = defineProps({
    slug: {
        type: String,
        required: true
    },
    type: {
        type: String as () => 'sport' | 'country',
        required: true,
        validator: (val: string) => ['sport', 'country'].includes(val)
    }
});

const chartContainer = ref<HTMLDivElement | null>(null);

const createPieChart = () => {
    if (!chartContainer.value) return;

    d3.select(chartContainer.value).selectAll('*').remove();

    // Get the actual container size
    const containerWidth = chartContainer.value.clientWidth;
    const containerHeight = chartContainer.value.clientHeight;

    // Use the smaller dimension to ensure the chart fits
    const chartSize = Math.min(containerWidth, containerHeight);

    // Set a minimum size to prevent tiny charts
    const width = Math.max(chartSize, 150);
    const height = Math.max(chartSize, 150);

    const margin = width * 0.08; // Responsive margin (8% of width)
    const radius = Math.min(width, height) / 2 - margin;

    const filteredAthletes = Object.values(athletes).filter((athlete: any) => {
        if (props.type === 'sport') {
            return athlete.sports?.some((s: any) => s === props.slug);
        } else if (props.type === 'country') {
            return athlete.country === props.slug;
        }
        return false;
    });

    const genderCounts: Record<string, number> = filteredAthletes.reduce((acc: Record<string, number>, athlete: any) => {
        acc[athlete.gender] = (acc[athlete.gender] || 0) + 1;
        return acc;
    }, {});

    const total = Object.values(genderCounts).reduce((sum: number, c: any) => sum + c, 0);

    const data = Object.entries(genderCounts).map(([gender, count]) => ({
        gender,
        count,
        percentage: (count / total) * 100
    }));

    const color = d3.scaleOrdinal<string>()
        .domain(['Male', 'Female'])
        .range(['#3b82f6', '#ec4899']);

    // Calculate extra space needed for legend
    const legendWidth = width * 0.35; // Reserve space for legend
    const totalWidth = width + legendWidth;

    const svg = d3.select(chartContainer.value)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${totalWidth} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

    const pie = d3.pie<any>()
        .value(d => d.count)
        .sort(null);

    // Scale inner radius based on chart size
    const innerRadiusRatio = width < 200 ? 0.3 : 0.4;

    const arc = d3.arc()
        .innerRadius(radius * innerRadiusRatio)
        .outerRadius(radius);

    const arcHover = d3.arc()
        .innerRadius(radius * (innerRadiusRatio - 0.05))
        .outerRadius(radius + (width * 0.02));

    // Create an arc generator for the initial animation state (zero degrees)
    const arcAnimStart = d3.arc()
        .innerRadius(radius * innerRadiusRatio)
        .outerRadius(radius)
        .startAngle(d => 0)
        .endAngle(d => 0);
        
    const paths = svg.selectAll('path')
        .data(pie(data))
        .enter()
        .append('path')
        .attr('d', arcAnimStart as any) // Start with zero-degree arcs
        .attr('fill', (d: any) => color(d.data.gender))
        .style('cursor', 'pointer')
        .on('mouseover', function () {
            d3.select(this).transition().duration(200).attr('d', arcHover as any);
        })
        .on('mouseout', function () {
            d3.select(this).transition().duration(200).attr('d', arc as any);
        });
        
    // Animate the arcs from zero degrees to their final position with a more dynamic animation
    paths.transition()
        .duration(1500)
        .ease(d3.easeCubicOut)
        .attrTween('d', function(d: any) {
            const interpolate = d3.interpolate(
                { startAngle: 0, endAngle: 0 },
                { startAngle: d.startAngle, endAngle: d.endAngle }
            );
            return function(t) {
                return arc(interpolate(t)) as string;
            };
        });

    // Add percentage labels inside the pie slices
    const labelArc = d3.arc()
        .innerRadius(radius * 0.66)
        .outerRadius(radius * 0.66);

    // Responsive font size based on chart width
    const fontSize = Math.max(10, Math.min(13, width / 18));

    svg.selectAll('text')
        .data(pie(data))
        .enter()
        .append('text')
        .attr('transform', (d: any) => `translate(${labelArc.centroid(d)})`)
        .attr('dy', '0.35em')
        .style('text-anchor', 'middle')
        .style('font-size', `${fontSize}px`)
        .style('fill', '#fff')
        .style('pointer-events', 'none')
        .style('opacity', 0) // Start invisible
        .text((d: any) => `${d.data.count}`)
        .transition() // Add fade-in animation for text
        .delay(400) // Wait a moment for pie animation to progress
        .duration(600)
        .style('opacity', 1);

    // Legend group (always visible, on the side)
    // Calculate optimal legend position based on chart size
    const legendOffsetX = radius * 1.1; // Position legend to the right of pie
    const legendOffsetY = -radius * 0.1; // Center legend vertically

    const legendGroup = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${legendOffsetX}, ${legendOffsetY})`);

    const legendSpacing = fontSize * 1.4;
    const legend = legendGroup.selectAll('.legend-item')
        .data(data)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (_d, i) => `translate(0, ${i * legendSpacing})`)
        .style('opacity', 0); // Start invisible
        
    // Animate legend items fading in
    legend.transition()
        .delay(600) // Wait for pie and text animations
        .duration(400)
        .style('opacity', 1);

    const legendRectSize = fontSize * 0.9;

    legend.append('rect')
        .attr('x', 0)
        .attr('y', -legendRectSize * 0.8)
        .attr('width', legendRectSize)
        .attr('height', legendRectSize)
        .attr('fill', d => color(d.gender));

    legend.append('text')
        .attr('x', legendRectSize * 1.5)
        .attr('y', -3)
        .style('fill', () => document.documentElement.classList.contains('dark') ? '#e5e5e5' : '#555')
        .style('font-size', `${fontSize}px`)
        .style('alignment-baseline', 'middle')
        .style('dominant-baseline', 'middle') // Ensure text is vertically centered
        .text(d => `${d.gender} - ${Number.isInteger(d.percentage) ? Math.floor(d.percentage) : d.percentage.toFixed(1)}%`);
};

// Handle window resize
const handleResize = () => {
    createPieChart();
};

// Add resize observer for more responsive updates
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    // Small delay to ensure the container has been sized correctly
    setTimeout(createPieChart, 10);

    // Add traditional resize event
    window.addEventListener('resize', handleResize);

    // Use ResizeObserver for more accurate container size monitoring
    if (window.ResizeObserver && chartContainer.value) {
        resizeObserver = new ResizeObserver(() => {
            createPieChart();
        });
        resizeObserver.observe(chartContainer.value);
    }
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);

    // Clean up observer
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
});

watch(() => props.slug, createPieChart);
</script>
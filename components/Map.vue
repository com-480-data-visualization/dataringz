<template>
    <div ref="mapContainer" :class="['flex-1 relative overflow-hidden', { 'pointer-events-none': introPlaying }]"></div>
    <button ref="skipButton" v-show="showSkipButton" @click="skipIntro"
        class="absolute bottom-30 left-1/2 transform -translate-x-1/2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 hover:dark:text-zinc-300 px-4 py-2 rounded-lg shadow-md backdrop-blur-3xl">
        skip intro
    </button>
    <div ref="textContainer" v-if="showText"
        class="text absolute top-10 left-1/2 transform -translate-x-1/2 text-zinc-900 dark:text-gray-100 p-4 text-center"
        style="clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 100%)}">
        {{ currentText }}
    </div>
</template>

<script setup lang="ts">
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl, { type EasingOptions, type MapOptions, type Marker } from 'mapbox-gl';

import { playIntro } from "~/utils/intro";
import { setFinalProperties, setMarkers, updateOutMarkers } from '~/utils/map';
import { displaySkipButton, hideSkipButton } from '~/utils/animations';
import { start, paris } from '~/utils/constants';

const isClient = import.meta.client;
const config = useRuntimeConfig();
const router = useRouter();

if (isClient) {
    mapboxgl.accessToken = config.public.MAPBOX_API_KEY || '';
}
const intro = config.public.INTRO || '';
const venueState = useState('venue');

// REFS ------------------------------------------------------------------------------------------------------------- //
const mapContainer = ref<HTMLElement | null>(null);
const textContainer = ref<HTMLElement | null>(null);
const showText = ref<boolean>(false);
const currentText = ref<string>('');
const introPlaying = ref<boolean>(false);
const skipButton = ref<HTMLElement | null>(null);
const showSkipButton = ref<boolean>(false);

// SKIP INTRO LOGIC ------------------------------------------------------------------------------------------------- //
const controller = new AbortController();
const { signal } = controller;

const skipIntro = async () => {
    controller.abort();
    introPlaying.value = false;
    showText.value = false;
    await new Promise<void>((resolve) => {
        map.flyTo({
            ...paris,
            duration: 2000,
            essential: true,
            curve: 1,
        } as EasingOptions);
        map.once('moveend', () => resolve());
    }).catch(() => { });
    setFinalProperties(map);
    await setMarkers(map, router);
};

watch(introPlaying, async (newVal) => {
    if (newVal) {
        displaySkipButton(showSkipButton, skipButton);
    } else {
        hideSkipButton(showSkipButton, skipButton);
    }
});

// COLOR SCHEME ----------------------------------------------------------------------------------------------------- //
const color = computed(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'mapbox://styles/mapbox/dark-v11'
        : 'mapbox://styles/mapbox/light-v11';
});

let map: mapboxgl.Map;
let venues: { [key: string]: any };
let outMarkers = new Map<Marker, Marker>();
let lastZoom: number = 0;
let venue: boolean = false;

onMounted(async () => {
    if (!isClient) return;

    // FETCH VENUES ------------------------------------------------------------------------------------------------- //
    venues = await fetch('/data/venues.json').then((res) => res.json());


    // HANDLE VENUE PAGE -------------------------------------------------------------------------------------------- //
    let venueCoordinates = [] as number[];
    if (venueState.value) {
        venue = true;
        const data = venues[venueState.value as string];
        venueCoordinates = [data.location.longitude, data.location.latitude];
    }

    // CREATE MAP --------------------------------------------------------------------------------------------------- //
    if (intro || venue) {
        map = new mapboxgl.Map({
            container: mapContainer.value as HTMLElement,
            style: color.value,
            maxZoom: 16,
            dragRotate: false,
            ...start
        } as MapOptions);
    } else {
        map = new mapboxgl.Map({
            container: mapContainer.value as HTMLElement,
            style: color.value,
            maxZoom: 16,
            minZoom: 10,
            dragRotate: false,
            maxBounds: [
                [2.0575, 48.0000],
                [3.0079, 49.9999]
            ],
            ...paris,
        } as MapOptions);
    }

    map.on('style.load', async () => {

        // REMOVE SYMBOLS (e.g. street names, places, ...) ---------------------------------------------------------- //
        map.style.stylesheet.layers.forEach((layer) => {
            if (layer.type === 'symbol') {
                map.removeLayer(layer.id);
            }
        });

        // ADD 3D BUILDINGS LAYER ----------------------------------------------------------------------------------- //
        map.addLayer(
            {
                id: 'add-3d-buildings',
                source: 'composite',
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: 14.95,
                paint: {
                    'fill-extrusion-color': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false],
                        '#ff0000',
                        '#aaa'
                    ],
                    'fill-extrusion-height': ['get', 'height'],
                    'fill-extrusion-base': ['get', 'min_height'],
                    'fill-extrusion-opacity': 0.6
                }
            },
        );

        // COLOR SPECIFIC BUILDINGS --------------------------------------------------------------------------------- //
        Object.keys(venues).forEach(key => {
            venues[key].buildingIds.forEach((id: number) => {
                map.setFeatureState(
                    { source: 'composite', sourceLayer: 'building', id },
                    { selected: true }
                );
            });
        });

        // PLAY INTRO ANIMATION ------------------------------------------------------------------------------------- //
        if (intro && !venue) {
            introPlaying.value = true;
            await playIntro(map, signal, showText, textContainer, currentText);
            introPlaying.value = false;
        } else if (venue) {
            await new Promise<void>(async (resolve, reject) => {
                if (signal.aborted) return reject();
                map.flyTo({ center: venueCoordinates, zoom: 15.5, bearing: 0, pitch: 55, duration: 4000, essential: true, curve: 1 } as EasingOptions);
                map.once('moveend', () => resolve());
            }).catch(() => { });
        }

        // SET FINAL PROPERTIES & ADD MARKERS ----------------------------------------------------------------------- //
        setFinalProperties(map);
        await setMarkers(map, router);
    });

    // OUT MARKERS UPDATE LOGIC ------------------------------------------------------------------------------------- //
    map.on('move', () => {
        const zoom = map.getZoom()
        updateOutMarkers(map, outMarkers, zoom, lastZoom);
        lastZoom = zoom;
    })
});

onUnmounted(() => {
    if (isClient && map) {
        map.remove();
    }
});


</script>
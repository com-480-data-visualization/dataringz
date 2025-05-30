<template>
    <PageModal :show="showEventPage" :transition="transition" :back="transition" :items="items" @close="closePage"
        @back="router.back()">
        <div v-if="event" class="h-full">
            <div class="flex flex-col items-center justify-center h-full"
                :class="{ '!items-stretch': event.tournament && tournamentMatches.length > 0 }">
                <h3 class="font-medium text-center text-zinc-500 dark:text-zinc-400 mb-3">
                    {{ event.sport_name }} | {{ event.name }}
                </h3>

                <div class="flex-1 min-h-0" :class="{ 'w-full': event.tournament && tournamentMatches.length > 0 }">
                    <div v-if="event.tournament && tournamentMatches.length > 0" class="w-full h-full overflow-x-auto">
                        <div class="min-w-[1200px] md:min-w-auto h-full">
                            <D3Tournament :matches="tournamentMatches" class="w-full h-full" />
                        </div>
                    </div>

                    <div v-else-if="stageNames.length > 1" class="h-full flex flex-col gap-4 items-center">
                        <USelect v-model="selectedStage" :items="stageNames" class="w-64"></USelect>
                        <UTable v-if="currentStageData.length > 0" :data="currentStageData" :columns="eventColumns"
                            sticky />
                    </div>

                    <div v-else-if="currentStageData.length > 0" class="h-full overflow-x-auto">
                        <UTable :data="currentStageData" :columns="eventColumns" sticky />
                    </div>

                    <p v-else
                        class="h-full flex items-center justify-center text-xs md:text-sm text-zinc-600 dark:text-gray-400">
                        Data is not yet available.
                    </p>
                </div>
            </div>
        </div>
        <div v-else class="h-full flex items-center justify-center">
            <p class="text-sm md:text-sm text-gray-600 dark:text-gray-400">Event not found.</p>
        </div>
    </PageModal>
</template>

<script setup lang="ts">
import events from '~/data/events.json';

definePageMeta({
    middleware: ['event', 'previous', 'breadcrumb'],
    layout: 'canvas'
});

// HANDLE DIRECT URL ---------------
let directAccess = !!useState('event').value;
const showEventPage = ref(!directAccess);
onMounted(async () => {
    if (directAccess) {
        setTimeout(() => showEventPage.value = true, 4200);
    }
});

// ROUTING PARAMETERS --------------
const router = useRouter();
const route = useRoute();
const slug = route.params.slug as string;

// DATA MANAGEMENT -----------------
const event = events[slug as keyof typeof events] as any;

// STAGE MANAGEMENT ----------------
const stageNames = computed(() => {
    if (!event?.results) return [];
    return Object.keys(event.results);
});

const selectedStage = ref('');

// Initialize selected stage
watch(stageNames, (newStages) => {
    if (newStages.length > 0 && !selectedStage.value) {
        // Prioritize stages in order of importance
        const stagePriority = [
            'Final Results',
            'Final',
            'Gold Medal Game',
            'Bronze Medal Game',
            'Semi-Final',
            'Semifinal',
            'Quarter-Final',
            'Quarterfinal'
        ];

        let selectedStageFound = false;
        for (const priority of stagePriority) {
            const matchingStage = newStages.find(stage =>
                stage.toLowerCase().includes(priority.toLowerCase())
            );
            if (matchingStage) {
                selectedStage.value = matchingStage;
                selectedStageFound = true;
                break;
            }
        }

        // If no priority stage found, use the first stage
        if (!selectedStageFound) {
            selectedStage.value = newStages[0];
        }
    }
}, { immediate: true });

// CURRENT STAGE DATA --------------
const currentStageData = computed(() => {
    if (!event?.results || !selectedStage.value) return [];
    return event.results[selectedStage.value] || [];
});

// TOURNAMENT MATCHES CONVERSION ---
const tournamentMatches = computed(() => {
    if (!event?.tournament || !event?.results) return [];

    const matches: any[] = [];
    let matchId = 0;

    // Define knockout stage patterns (these are the ones we want to show in tournament bracket)
    const knockoutStages = [
        'Round of 32', 'Round of 16', 'Quarterfinal', 'Quarter-Final', 'Quarterfinals', 'Quarter-Finals',
        'Semifinal', 'Semi-Final', 'Semifinals', 'Semi-Finals',
        'Final', 'Gold Medal Game', 'Gold Medal Match', 'Gold Medal Battle', 'Gold Medal Bout', 'Gold Medal Contest',
        'Bronze Medal Game', 'Bronze Medal Match', 'Bronze Medal Battle', 'Bronze Medal Bout', 'Bronze Medal Contest'
    ];

    // Filter only knockout stages
    const knockoutStageEntries = Object.entries(event.results).filter(([stageName]) => {
        return knockoutStages.some(pattern =>
            stageName.toLowerCase().includes(pattern.toLowerCase())
        );
    });

    // Sort stages by tournament progression order
    const stageOrder = [
        'Round of 32', 'Round of 16',
        'Quarterfinal', 'Quarter-Final', 'Quarterfinals', 'Quarter-Finals',
        'Semifinal', 'Semi-Final', 'Semifinals', 'Semi-Finals',
        'Final',
        'Gold Medal Game', 'Gold Medal Match', 'Gold Medal Battle', 'Gold Medal Bout', 'Gold Medal Contest',
        'Bronze Medal Game', 'Bronze Medal Match', 'Bronze Medal Battle', 'Bronze Medal Bout', 'Bronze Medal Contest'
    ];

    const sortedStages = knockoutStageEntries.sort(([stageA], [stageB]) => {
        const indexA = stageOrder.findIndex(stage =>
            stageA.toLowerCase().includes(stage.toLowerCase())
        );
        const indexB = stageOrder.findIndex(stage =>
            stageB.toLowerCase().includes(stage.toLowerCase())
        );

        // If both stages are medal matches/contests, preserve their original order
        const isAMedal = stageA.toLowerCase().includes('medal');
        const isBMedal = stageB.toLowerCase().includes('medal');
        if (isAMedal && isBMedal) {
            // Put gold medal matches before bronze medal matches
            const isAGold = stageA.toLowerCase().includes('gold');
            const isBGold = stageB.toLowerCase().includes('gold');
            if (isAGold !== isBGold) {
                return isAGold ? -1 : 1;
            }
        }

        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    // Convert stages to tournament matches
    sortedStages.forEach(([stageName, stageData]: [string, any]) => {
        if (!Array.isArray(stageData)) return;

        const roundNumber = getRoundNumber(stageName);
        const isBronzeMedal = stageName.toLowerCase().includes('bronze');
        const isGoldMedal = stageName.toLowerCase().includes('gold') ||
            (stageName.toLowerCase().includes('final') &&
                !stageName.toLowerCase().includes('semi') &&
                !stageName.toLowerCase().includes('quarter') &&
                !stageName.toLowerCase().includes('bronze'));

        // Filter participants with results (winners/losers)
        const participants = stageData.filter((result: any) =>
            result.result_WLT && (result.result_WLT === 'W' || result.result_WLT === 'L')
        );

        // Remove duplicates based on participant name
        const uniqueParticipants = participants.filter((participant: any, index: number, arr: any[]) => {
            return arr.findIndex(p => p.participant_name === participant.participant_name) === index;
        });

        // For knockout stages, we need to identify actual head-to-head matches
        // In a proper knockout tournament, each participant should appear in exactly one match per round
        const validMatchups = new Map<string, any[]>();
        const usedParticipants = new Set<string>();

        // Sort participants to ensure consistent pairing
        uniqueParticipants.sort((a: any, b: any) =>
            (a.participant_name || '').localeCompare(b.participant_name || '')
        );

        // Pair participants sequentially, ensuring each participant is used only once
        for (let i = 0; i < uniqueParticipants.length; i += 2) {
            if (i + 1 < uniqueParticipants.length) {
                const team1 = uniqueParticipants[i];
                const team2 = uniqueParticipants[i + 1];

                // Skip if it's the same team or if either participant is already used
                if (team1.participant_name === team2.participant_name ||
                    usedParticipants.has(team1.participant_name) ||
                    usedParticipants.has(team2.participant_name)) {
                    continue;
                }

                // Create a consistent key for the matchup
                const teams = [team1.participant_name, team2.participant_name].sort();
                const matchKey = teams.join(' vs ');

                if (!validMatchups.has(matchKey)) {
                    validMatchups.set(matchKey, [team1, team2]);
                    usedParticipants.add(team1.participant_name);
                    usedParticipants.add(team2.participant_name);
                }
            }
        }

        // Create match objects from valid matchups
        let matchIndex = 0;
        validMatchups.forEach(([team1, team2]) => {
            // Determine winner based on result_WLT
            let winner = undefined;
            if (team1.result_WLT === 'W' && team2.result_WLT === 'L') {
                winner = team1.participant_name;
            } else if (team2.result_WLT === 'W' && team1.result_WLT === 'L') {
                winner = team2.participant_name;
            }

            // For bronze medal matches, use match index 1 to avoid conflict with gold medal match
            const finalMatchIndex = isBronzeMedal ? 1 : matchIndex;
            let match = {
                id: `match-${matchId++}`,
                round: roundNumber,
                match: finalMatchIndex,
                participant1: team1.participant_name,
                participant2: team2.participant_name,
                participant1Img: team1.img,
                participant2Img: team2.img,
                winner: winner,
                score1: team1.result,
                score2: team2.result,
                isBronzeMedal: isBronzeMedal,
                isGoldMedal: isGoldMedal
            } as any;

            if (team1.participant_type === 'Person') {
                match["participant1Slug"] = team1.athlete_slug;
                match["participantType"] = 'Person';
            }
            else if (team1.participant_type === 'Doubles') {
                match['participant1Athlete1Slug'] = team1.athlete_slug_1;
                match['participant1Athlete2Slug'] = team1.athlete_slug_2;
                match['participantType'] = "Doubles"
            } else {
                match["participant1Slug"] = team1.country_slug;
                match["participantType"] = 'Country';
            }
            if (team2.participant_type === 'Person') {
                match["participant2Slug"] = team2.athlete_slug;
            } else if (team2.participant_type === 'Doubles') {
                match['participant2Athlete1Slug'] = team2.athlete_slug_1;
                match['participant2Athlete2Slug'] = team2.athlete_slug_2;
            } else {
                match["participant2Slug"] = team2.country_slug;
            }

            matches.push(match);
            if (!isBronzeMedal) matchIndex++;
        });
    });

    // Normalize round numbers to start from 0
    if (matches.length > 0) {
        const minRound = Math.min(...matches.map(m => m.round));
        if (minRound > 0) {
            matches.forEach(match => {
                match.round = match.round - minRound;
            });
        }
    }

    return matches.sort((a, b) => {
        // Sort by round first, then by match number
        if (a.round !== b.round) return a.round - b.round;
        // Put bronze medal matches after gold medal matches in the same round
        if (a.isBronzeMedal && !b.isBronzeMedal) return 1;
        if (!a.isBronzeMedal && b.isBronzeMedal) return -1;
        return a.match - b.match;
    });
});

// Helper function to determine round number
const getRoundNumber = (stageName: string): number => {
    const stage = stageName.toLowerCase();

    // Map stages to sequential round numbers for proper tournament progression
    if (stage.includes('round of 32')) return 0;
    if (stage.includes('round of 16')) return 1;
    if (stage.includes('quarterfinal') || stage.includes('quarter-final') || stage.includes('quarter final')) return 2;
    if (stage.includes('semifinal') || stage.includes('semi-final') || stage.includes('semi final')) return 3;

    // Final round (3) - both gold and bronze medal matches/contests
    if (stage.includes('final') && !stage.includes('semi')) return 4;
    if (stage.includes('gold') || stage.includes('bronze')) return 4;

    // Default fallback
    return 0;
};

// HANDLE BREADCRUMB ---------------
const items = useState<Array<{ slug: string, to: string }>>('breadcrumb');

// HANDLE TRANSITION ------------------------------
const previousCard = useState('previous');
const transition = computed(() => previousCard.value && previousCard.value !== '/' && !directAccess) as ComputedRef<boolean>;

// HANDLE CLOSE BUTTON ----------------------------
const closePage = () => {
    showEventPage.value = false;
    router.push('/');
}

useHead(() => {
    if (event === undefined) return;
    const eventName = event.name;
    const sportName = event.sport_name;
    const isTournament = event.tournament;
    const hasResults = event.results && Object.keys(event.results).length > 0;

    const title = `${eventName} - ${sportName} | Paris 2024 Olympic Games`;
    const description = `Follow the ${eventName} ${isTournament ? 'tournament ' : ''}in ${sportName} at the Paris 2024 Olympic Games. ${hasResults ? 'View results and standings.' : 'Competition details and schedule.'}`;

    return {
        title,
        meta: [
            { name: 'description', content: description },
            // Open Graph
            { property: 'og:title', content: title },
            { property: 'og:description', content: description },
            { property: 'og:url', content: `https://dataringz.martinctl.dev/event/${slug}` },
            { property: 'og:type', content: 'website' },

            // Twitter
            { name: 'twitter:card', content: 'summary' },
            { name: 'twitter:title', content: title },
            { name: 'twitter:description', content: description }
        ],
        link: [
            { rel: 'canonical', href: `https://dataringz.martinctl.dev/event/${slug}` },
            { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        ]
    };
});

// UI STATE
const eventColumns = [
    {
        accessorKey: 'rank',
        header: '',
        cell: ({ row }: { row: any }) => {
            let rank = row.getValue('rank');
            if (rank === 1) rank = '🥇';
            else if (rank === 2) rank = '🥈';
            else if (rank === 3) rank = '🥉';
            else if (!rank) rank = '-';
            return h('div', { class: 'flex justify-center' }, [
                h('span', { class: 'font-bold' }, rank)
            ]);
        }
    },
    {
        accessorKey: 'participant_name',
        header: () => {
            return currentStageData.value &&
                currentStageData.value.length > 0 &&
                currentStageData.value[0]["participant_type"] &&
                currentStageData.value[0]["participant_type"] == "Country" ?
                'Athletes' : 'Athlete'
        },
        cell: ({ row }: { row: any }) => {
            const athleteNames = row.original["athlete_names"];
            const athleteSlugs = row.original["athlete_slugs"];

            if (Array.isArray(athleteNames) && Array.isArray(athleteSlugs) && athleteNames.length === athleteSlugs.length) {
                return h('div', {
                    class: 'grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2'
                },
                    athleteNames.map((name: string, idx: number) => {
                        const slug = athleteSlugs[idx];
                        return slug
                            ? h(resolveComponent('NuxtLink'), {
                                class: 'flex items-center justify-left hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:px-3 rounded-lg py-1 transition-all duration-300 ease',
                                to: `/athlete/${slug}`,
                                key: slug
                            }, () => name)
                            : h('span', { class: 'px-2' }, name);
                    })
                );
            }

            const athleteName = row.getValue('participant_name') || 'Unknown';
            const athleteSlug = row.original["athlete_slug"];

            return athleteSlug
                ? h(resolveComponent('NuxtLink'), {
                    class: 'flex items-center justify-left hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:px-3 rounded-lg py-2 transition-all duration-300 ease',
                    to: `/athlete/${athleteSlug}`
                }, () => athleteName)
                : athleteName;
        },
    },
    {
        accessorKey: 'participant_country',
        header: 'Country',
        cell: ({ row }: { row: any }) => {
            const countryName = row.getValue('participant_country') || 'Unknown';
            const countrySlug = row.original["country_slug"];
            const imgPath = row.original["img"];

            const countryContent = () => h('div', { class: 'flex items-center md:justify-start justify-center w-full' }, [
                imgPath ? h('img', {
                    src: imgPath,
                    alt: countryName,
                    class: 'w-5 h-5 md:mr-2 rounded-full object-cover',
                    onError: (e: any) => {
                        e.target.style.display = 'none';
                    }
                }) : null,
                h('span', { class: 'hidden md:inline' }, countryName)
            ]);

            return countrySlug ? h(resolveComponent('NuxtLink'), {
                class: 'flex items-center justify-left hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:px-3 rounded-lg py-2 transition-all duration-300 ease',
                to: `/country/${countrySlug}`
            }, countryContent) : countryContent();
        }
    },
    {
        accessorKey: 'result',
        header: 'Result',
        cell: ({ row }: { row: any }) => {
            const resultType = row.original["result_type"];
            let result = row.getValue('result');
            if (!result) result = '-';

            try {
                if (resultType === "TIME") return formatTime(result);
                else if (resultType === "DISTANCE") return formatDistance(result);
                else if (resultType === "POINTS") return `${result} pts`;
                return result;
            } catch (error) {
                console.warn('Error formatting result:', error);
                return result;
            }
        }
    }
];
</script>
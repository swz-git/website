<script>
    import { onMount } from "svelte";
    import rlbotmono from "../../assets/icons/RLBotMono.svg?url";

    export let calendarId;
    export let maxResults;
    export let subscribeUrl;
    export let apiKey;

    const skeletons = Array.from({ length: 6 });
    let events = [];
    let loading = true;
    let errorMessage = "";

    function formatEventParts(start) {
        const date = start.date
            ? new Date(`${start.date}T00:00:00`)
            : new Date(start.dateTime);

        return {
            day: new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(
                date,
            ),
            month: new Intl.DateTimeFormat(undefined, {
                month: "short",
            }).format(date),
            year: new Intl.DateTimeFormat(undefined, {
                year: "numeric",
            }).format(date),
            time: start.date
                ? "All day"
                : new Intl.DateTimeFormat(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                  }).format(date),
        };
    }

    function isSafeImageUrl(url) {
        try {
            const { protocol } = new URL(url);
            return protocol === "https:" || protocol === "http:";
        } catch {
            return false;
        }
    }

    function extractLogoUrl(description) {
        if (!description) return null;

        const doc = new DOMParser().parseFromString(description, "text/html");

        for (const anchor of doc.querySelectorAll("a[href]")) {
            if (/logo/i.test(anchor.textContent || "")) {
                return isSafeImageUrl(anchor.href) ? anchor.href : null;
            }
        }

        const match = (doc.body.textContent || "").match(/logo:\s*(\S+)/i);
        const url = match ? match[1] : null;
        return url && isSafeImageUrl(url) ? url : null;
    }

    function firstLetter(name) {
        return (name || "?").trim().charAt(0).toUpperCase() || "?";
    }

    function showLogoFallback(event) {
        const image = event.currentTarget;
        image.hidden = true;
        image.nextElementSibling.hidden = false;
    }

    async function loadEvents() {
        if (!apiKey) {
            errorMessage =
                "Upcoming events are unavailable because no Google Calendar API key is configured.";
            loading = false;
            return;
        }

        const url = new URL(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        );
        url.searchParams.set("key", apiKey);
        url.searchParams.set("timeMin", new Date().toISOString());
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
        url.searchParams.set("maxResults", String(maxResults));

        try {
            const response = await fetch(url, {
                headers: { Accept: "application/json" },
            });

            if (!response.ok) {
                throw new Error(
                    `Calendar request failed with ${response.status}`,
                );
            }

            const data = await response.json();
            events = data.items ?? [];
        } catch (error) {
            console.error("Failed to load upcoming events:", error);
            errorMessage = "We couldn't load the upcoming events right now.";
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        void loadEvents();
    });
</script>

{#if errorMessage}
    <p
        class="events-status"
        data-events-status
        role="status"
        aria-live="polite"
    >
        {errorMessage}
        <a href={subscribeUrl}>View the calendar directly</a>.
    </p>
{/if}

<ul class="events" data-events-list aria-busy={loading} hidden={!!errorMessage}>
    {#if loading}
        {#each skeletons as _}
            <li class="card event-skeleton" aria-hidden="true">
                <span class="skeleton-line skeleton-logo"></span>
                <span class="skeleton-stack">
                    <span class="skeleton-line skeleton-name"></span>
                    <span class="skeleton-line skeleton-time"></span>
                </span>
            </li>
        {/each}
    {:else if events.length === 0}
        <li class="event event-empty">
            No upcoming events scheduled, check back soon!
        </li>
    {:else}
        {#each events as item}
            {@const name = item.summary || "Untitled event"}
            {@const parts = formatEventParts(item.start)}
            {@const logoUrl = extractLogoUrl(item.description)}
            <li class="event">
                <a
                    class="card"
                    href={item.htmlLink || subscribeUrl}
                    rel="noopener"
                >
                    <div class="left">
                        <img
                            src={logoUrl ?? rlbotmono}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            referrerpolicy="no-referrer"
                            onerror={showLogoFallback}
                        />
                    </div>

                    <span class="event-info">
                        <h3>{name}</h3>
                        <h4>{parts.day} {parts.month} {parts.year}</h4>
                    </span>

                    <span class="event-arrow" aria-hidden="true">
                        <svg viewBox="0 0 16 16" width="16" height="16">
                            <path
                                d="M6 3l5 5-5 5"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                    </span>
                </a>
            </li>
        {/each}
    {/if}
</ul>

<style>
    .events {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(25rem, 100%), 1fr));
        gap: 14px;
    }

    /* The list is hidden when it failed to load, but the UA's [hidden] rule
       loses against the grid display above. */
    .events[hidden] {
        display: none;
    }

    .event-info :is(h3, h4) {
        margin: 0;
    }

    .event {
        min-width: 0;
    }

    .event .card {
        padding: 0.5rem;
    }

    .event .left {
        display: flex;
        flex-direction: column;
    }

    .event img {
        flex-shrink: 0;
        width: auto;
        height: 8rem;
        padding: 0.5rem;
        object-fit: contain;
    }

    .event-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
        line-height: 1.15;
    }

    .event-info h4 {
        font-weight: 400;
    }

    .event-arrow {
        margin-left: auto;
        color: var(--fg-muted);
        transition:
            transform 0.18s ease,
            color 0.18s ease;
    }

    .event:hover .event-arrow {
        color: var(--accent);
        transform: translateX(3px);
    }

    .event-empty {
        grid-column: 1 / -1;
        color: var(--fg-muted);
    }

    .event-skeleton {
        pointer-events: none;
    }

    .skeleton-line {
        display: block;
        height: 1em;
        border-radius: 6px;
        background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.08) 25%,
            rgba(255, 255, 255, 0.18) 37%,
            rgba(255, 255, 255, 0.08) 63%
        );
        background-size: 400% 100%;
        animation: skeleton-shimmer 1.4s ease infinite;
    }

    .skeleton-logo {
        width: 6rem;
        height: 6rem;
        border-radius: 12px;
    }

    .skeleton-stack {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        min-width: 0;
    }

    .skeleton-name {
        width: min(70%, 22rem);
    }

    .skeleton-time {
        width: 6rem;
        height: 0.75em;
    }

    @keyframes skeleton-shimmer {
        from {
            background-position: 100% 50%;
        }

        to {
            background-position: 0 50%;
        }
    }

    .events-status {
        margin: 0 0 10px;
        color: #f0b8b8;
    }

    .events-status a {
        color: inherit;
    }

    @media (prefers-reduced-motion: reduce) {
        .skeleton-line,
        .event-arrow {
            animation: none;
            transition: none;
        }
    }
</style>

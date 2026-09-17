-- convert old relevance classes
-- export const gEventRelevanceClass = {
--     Ongoing: 1,
--     Upcoming: 2,
--     RecentPast: 3,
--     Future: 4,
--     Hidden: 999,
-- } as const;

-- to new:
-- export const gEventRelevanceClass = {
--     Pinned: 1000, // priority above others; explicitly pinned.
--     Ongoing: 1100,
--     Upcoming: 1200,
--     RecentPast: 1300,
--     TBD: 1400,
--     Future: 1500,
--     Hidden: 1600,
-- } as const;

update `Event`
set relevanceClassOverride = case relevanceClassOverride
    when 1 then 1100 -- Ongoing
    when 2 then 1200 -- Upcoming
    when 3 then 1300 -- RecentPast
    when 4 then 1500 -- Future
    when 999 then 1600 -- Hidden
end;

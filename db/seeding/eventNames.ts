import { faker } from "@faker-js/faker";

// Define arrays of words for event names
const adjectives = [
    'Grand', 'Epic', 'Legendary', 'Mystic', 'Electric', 'Harmonic', 'Vibrant', 'Groovy', 'Classic', 'Fusion', 'Ultimate',
    'Spectacular', 'Fantastic', 'Majestic', 'Radiant', 'Funky', 'Sonic', 'Blissful', 'Luminous', 'Dynamic', 'Extravagant',
    'Marvelous', 'Brilliant', 'Phenomenal', 'Magical', 'Enchanting', 'Energetic', 'Astounding', 'Remarkable'
];

const nouns = [
    'Festival', 'Concert', 'Party', 'Celebration', 'Gathering', 'Show', 'Extravaganza', 'Fiesta', 'Carnival', 'Gala',
    'Bash', 'Rave', 'Hoedown', 'Jubilee', 'Feast', 'Fair', 'Soiree', 'Meetup', 'Symphony', 'Ball', 'Recital', 'Session',
    'Performance', 'Function', 'Revelry', 'Ceremony', 'Blowout', 'Mixer', 'Slam'
];

const locations = [
    'Beach', 'Park', 'Hall', 'Arena', 'Center', 'Stadium', 'Plaza', 'Club', 'Garden', 'Ballroom', 'Theater', 'Auditorium',
    'Lounge', 'Pavilion', 'Court', 'Grounds', 'Field', 'Terrace', 'Rooftop', 'Boulevard', 'Promenade', 'Deck', 'Lawn',
    'Dome', 'Amphitheater'
];

const occasions = [
    'Wedding', 'Anniversary', 'Birthday', 'Reunion', 'Farewell', 'Welcome', 'Fundraiser', 'Charity', 'Launch', 'Opening',
    'Closing', 'Commemoration', 'Homecoming', 'Ceremony', 'Kickoff', 'Reception', 'Banquet', 'Gala', 'Gathering', 'Festival',
    'Showcase', 'Spectacle', 'Presentation', 'Bash', 'Picnic', 'Outing', 'Retreat', 'Convention', 'Symposium'
];

const prefixes = [
    'C\'est Pas de la', 'Le Grand', 'Mega', 'Ultra', 'The Annual', 'The Ultimate', 'The One and Only', 'The Legendary',
    'Super', 'Fantastic', 'Amazing', 'Incredible', 'The First Annual', 'The Grand', 'The Supreme', 'The Iconic', 'The Prestigious',
    'The Renowned', 'The Famous', 'The Celebrated', 'The Illustrious', 'The Notorious', 'The Historic', 'The Unforgettable',
    'The Magnificent', 'The Colossal', 'The Prodigious'
];

const suffixes = [
    '(Pre-show)', '(After Party)', '(Exclusive)', '(Free Entry)', '(VIP Only)', '(Open Air)', '(Live)', '(Special Edition)',
    '(Members Only)', '(Encore)', '(Matinee)', '(Late Night)', '(Festival Edition)', '(Charity Event)', '(Fundraiser)', '(Benefit)',
    '(Special Appearance)', '(One Night Only)', '(Tour)', '(Summer Edition)', '(Winter Edition)', '(Spring Fling)', '(Autumn Affair)',
    '(Gala Event)', '(Featuring Guest Artists)', '(With Special Guests)', '(Under the Stars)', '(Limited Tickets)'
];

export function generateEventName(): string {
    const adjective = faker.helpers.arrayElement(adjectives);
    const noun = faker.helpers.arrayElement(nouns);
    const location = faker.helpers.arrayElement(locations);
    const occasion = faker.helpers.arrayElement(occasions);
    const prefix = faker.helpers.arrayElement(prefixes);
    const suffix = faker.helpers.arrayElement(suffixes);

    const formats = [
        `${adjective} ${noun}`,
        `${adjective} ${noun} at the ${location}`,
        `${adjective} ${noun} for ${occasion}`,
        `${noun} at the ${location}`,
        `${noun} for ${occasion}`,
        `${adjective} ${occasion} ${noun}`,
        `${prefix} ${noun}`,
        `${prefix} ${noun} at the ${location}`,
        `${prefix} ${occasion} ${noun}`,
        `${adjective} ${noun} ${suffix}`,
        `${noun} at the ${location} ${suffix}`,
        `${prefix} ${noun} ${suffix}`
    ];

    return faker.helpers.arrayElement(formats);
}



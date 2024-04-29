// 0-dependency file.


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// slug field is calculated from another field.
// it is calculated live during creation, but afterwards it's user-editable.
// https://gist.github.com/codeguy/6684588
// this function must be idempotent for wikis in order to support slugifying user-input URLs.
export const slugify = (...args: (string | number)[]): string => {
    const value = args.join(' ');

    return value
        .normalize('NFD') // Split an accented letter into the base letter and the accent
        .replace(/[\u0300-\u036f]/g, '') // Remove all previously split accents
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9 _-]/g, '') // Allow single hyphens and spaces, disallow other characters
        .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and hyphens with a single hyphen
        .replace(/-+/g, '-'); // Replace multiple hyphens with a single hyphen
}

export const unslugify = (slug: string): string => {
    return slug
        .replace(/[-_]+/g, ' ') // Replace all hyphens or underscores with spaces
        .split(' ')
        .filter(s => s.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}


export const josefinaServiceIds = Object.freeze([
    "instagram",
    "tiktok",
    "youtube",
    "facebook",
]);

const josefinaServiceSet = new Set(josefinaServiceIds);

export const isJosefinaService = service => josefinaServiceSet.has(service);

export const createJosefinaServiceSet = () => new Set(josefinaServiceIds);

export const toId = (text: any, allowSpace = false): string => {
    if (text === null || text === undefined) return '';
    let id = ('' + text).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (allowSpace) id = ('' + text).toLowerCase().replace(/[^a-z0-9 ]/g, '');
    return id;
}
export const getCroppedString = (str: string, startLimit: number, endLimit: number): string => {
    if (str.length <= startLimit + endLimit) return str;

    return str.slice(0, startLimit) + '...' + str.slice(str.length - endLimit - 1, str.length)
}

export function camelCaseToTitleCase(camelCase: string) {
    return camelCase
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, function (str) {
            return str.toUpperCase();
        });
}

export function capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
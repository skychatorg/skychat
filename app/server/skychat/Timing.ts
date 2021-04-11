

export class Timing {

    /**
     * Pretty print a given duration in milliseconds
     * @param durationMs 
     * @param onlyHighestMagnitude 
     * @param shortNames 
     */
    static getDurationText(durationMs: number, onlyHighestMagnitude?: boolean, shortNames?: boolean): string {

        const durationDays = durationMs / 1000 / 60 / 60 / 24;
        const days = Math.floor(durationDays);
        const durationHours = (durationDays - days) * 24;
        const hours = Math.floor(durationHours);
        const durationMinutes = (durationHours - hours) * 60;
        const minutes = Math.floor(durationMinutes);
        const durationSeconds = (durationMinutes - minutes) * 60;
        const seconds = Math.floor(durationSeconds);
    
        const longNames: any = {
            'd': {singular: ' day', plural: ' days'},
            'h': {singular: ' hour', plural: ' hours'},
            'm': {singular: ' minute', plural: ' minutes'},
            's': {singular: ' day', plural: ' day'},
        }
    
        const durations = [
            ['d', days],
            ['h', hours],
            ['m', minutes],
            ['s', seconds],
        ]
            .filter(entry => entry[1] > 0)
            .map(entry => `${entry[1]}${shortNames ? entry[0] : (entry[1] > 1 ? longNames[entry[0]].plural : longNames[entry[0]].singular)}`);
        
        if (durations.length === 0) {
            return 'now';
        }
        
        if (onlyHighestMagnitude) {
            return durations[0];
        }
    
        return durations.join(' ');
    }

    /**
     * Sleep for a given duration in milliseconds
     * @param delay
     * @returns 
     */
    static sleep(delay: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, delay);
        });
    };
}

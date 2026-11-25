import { addDays, format } from 'date-fns';

// yyyy-MM-dd in local time, the format date inputs and the API use
export const daysFromToday = (days: number) => format(addDays(new Date(), days), 'yyyy-MM-dd');

import { createContext, useState } from 'react';

export interface MonthContextType {
    month: number;
    setMonth: (month: number) => void;

    trackIds: string[];
    setTrackIds: (trackIds: string[]) => void;
}

export const MonthContext = createContext<MonthContextType | undefined>(undefined);

export const MonthContextProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [month, setMonth] = useState(new Date().getMonth());
    const [trackIds, setTrackIds] = useState<string[]>([]);

    return (
        <MonthContext.Provider value={{ month, setMonth, trackIds, setTrackIds }}>
            {children}
        </MonthContext.Provider>
    );
}




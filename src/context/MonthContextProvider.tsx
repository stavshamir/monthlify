import { createContext, useState } from 'react';

export interface MonthContextType {
    month: number;
    setMonth: (month: number) => void;
}

export const MonthContext = createContext<MonthContextType | undefined>(undefined);

export const MonthContextProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [month, setMonth] = useState(new Date().getMonth());

    return (
        <MonthContext.Provider value={{ month, setMonth }}>
            {children}
        </MonthContext.Provider>
    );
}




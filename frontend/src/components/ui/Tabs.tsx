import React, { createContext, useContext, useState } from 'react';
import { clsx } from 'clsx';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

const useTabsContext = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used within <Tabs>');
  return ctx;
};

interface TabsProps {
  defaultTab?: string;
  value?: string;
  onTabChange?: (tab: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultTab = '',
  value,
  onTabChange,
  children,
  className,
}) => {
  const [internalTab, setInternalTab] = useState(defaultTab);
  const activeTab = value !== undefined ? value : internalTab;

  const setActiveTab = (tab: string) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabsList: React.FC<TabsListProps> = ({ children, className }) => (
  <div
    role="tablist"
    className={clsx(
      'flex items-center gap-1 p-1 bg-slate-900/60 border border-slate-800/60 rounded-xl',
      className
    )}
  >
    {children}
  </div>
);

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  disabled = false,
  className,
  icon,
}) => {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(value)}
      className={clsx(
        'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none',
        isActive
          ? 'bg-slate-800 text-slate-100 shadow-md'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
};

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, children, className }) => {
  const { activeTab } = useTabsContext();
  if (activeTab !== value) return null;
  return <div className={clsx('mt-4', className)}>{children}</div>;
};

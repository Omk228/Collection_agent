import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Home, Users, FileText, User, History, Navigation } from 'lucide-react';

interface BottomNavigationProps {
  activeTab?: string;
  onNavigate?: (screen: string) => void;
}

export function BottomNavigation({ activeTab, onNavigate }: BottomNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'agent', path: '/', label: 'Home', icon: User },
    { id: 'customers', path: '/customers', label: 'Customers', icon: Users },
    { id: 'map', path: '/live-location', label: 'Route Map', icon: Navigation },
    { id: 'history', path: '/history', label: 'History', icon: History },
    { id: 'reports', path: '/reports', label: 'Reports', icon: FileText },
  ];

  // Resolve current active tab
  const currentPath = location.pathname;
  let resolvedTab = activeTab;
  if (!resolvedTab) {
    if (currentPath === '/' || currentPath === '/agent') resolvedTab = 'agent';
    else if (currentPath.startsWith('/customers') || currentPath.startsWith('/customer')) resolvedTab = 'customers';
    else if (currentPath === '/live-location' || currentPath === '/map' || currentPath === '/route-map') resolvedTab = 'map';
    else if (currentPath.startsWith('/history') || currentPath.startsWith('/tools')) resolvedTab = 'history';
    else if (currentPath.startsWith('/reports')) resolvedTab = 'reports';
    else resolvedTab = 'agent';
  }

  const handleTabClick = (tab: typeof tabs[0]) => {
    if (onNavigate) {
      onNavigate(tab.id);
    }
    navigate(tab.path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-t border-border px-1 py-1 z-30 shadow-lg mobile-nav-bottom">
      <div className="flex justify-around items-center max-w-md mx-auto w-full gap-0.5">
        {tabs.map((tab) => {
          const isActive = resolvedTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              onClick={() => handleTabClick(tab)}
              className={`flex-1 min-w-0 max-w-[76px] flex flex-col items-center justify-center gap-1 h-auto py-1.5 px-1 rounded-xl transition-all active:scale-95 whitespace-nowrap ${
                isActive 
                  ? 'bg-linear-to-r from-fuchsia-600 to-purple-700 text-white shadow-md shadow-purple-600/30 font-bold' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <tab.icon className={`w-4 h-4 shrink-0 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] sm:text-[11px] font-semibold leading-none truncate w-full text-center">
                {tab.label}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
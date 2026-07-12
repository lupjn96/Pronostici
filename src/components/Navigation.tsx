/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LayoutDashboard, Calculator, History, GitCompare, Settings, ShieldAlert } from 'lucide-react';

interface NavigationProps {
  currentSection: string;
  setSection: (section: string) => void;
}

export default function Navigation({ currentSection, setSection }: NavigationProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'prediction', label: 'Previsione', icon: Calculator },
    { id: 'history', label: 'Storico', icon: History },
    { id: 'models', label: 'Modelli', icon: GitCompare },
    { id: 'settings', label: 'Impostazioni', icon: Settings },
  ];

  return (
    <>
      {/* Sidebar per Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-[#1e293b] border-r border-slate-700 text-slate-200 h-screen sticky top-0">
        <div className="p-6 border-b border-slate-700 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-emerald-400 shrink-0" />
            <h1 className="font-sans font-bold tracking-tight text-emerald-400 text-lg">
              FP Lab
            </h1>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
            Prediction Engine v1.0
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Poisson Model</span>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </div>
            <p className="text-[11px] text-slate-300">Stato: Attivo</p>
          </div>
        </div>
      </aside>

      {/* Bottom Navigation per Mobile (iPhone) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1e293b]/95 backdrop-blur-md border-t border-slate-700 z-50 px-2 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] transition-all cursor-pointer ${
                  isActive ? 'text-emerald-400 font-medium' : 'text-slate-400'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl mb-0.5 transition-all ${
                    isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

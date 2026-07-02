import React from 'react';
import { AppProvider, useAppState } from './state/AppContext';
import Header from './components/Header';
import DropZone from './components/DropZone';
import VideoStage from './components/VideoStage';
import Timeline from './components/Timeline';
import TrimReadout from './components/TrimReadout';
import ControlsPanel from './components/ControlsPanel';
import ExportBar from './components/ExportBar';

const AppContent: React.FC = () => {
  const { state } = useAppState();
  const { video } = state;

  return (
    <div className="app">
      <Header />
      {video ? (
        <>
          <VideoStage />
          <Timeline />
          <TrimReadout />
          <ControlsPanel />
          <ExportBar />
        </>
      ) : (
        <DropZone />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;

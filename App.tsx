import React, { useState, useCallback } from 'react';
import { UI } from './components/UI';
import { Experience } from './components/Experience';
import { AppMode } from './types';

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.TREE);
  const [newPhoto, setNewPhoto] = useState<string | null>(null);

  const handlePhotoUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setNewPhoto(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePhotoGenerated = useCallback((url: string) => {
    setNewPhoto(url);
  }, []);

  const clearNewPhoto = useCallback(() => {
    setNewPhoto(null);
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <Experience 
        mode={mode} 
        setMode={setMode} 
        newPhoto={newPhoto} 
        onPhotoAdded={clearNewPhoto} 
      />
      <UI 
        mode={mode}
        onPhotoUpload={handlePhotoUpload} 
        onPhotoGenerated={handlePhotoGenerated}
      />
    </div>
  );
}

export default App;

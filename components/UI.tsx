import React, { useState, useEffect } from 'react';
import { AppMode, ImageSize } from '../types';
import { generateChristmasImage, editImageWithGemini } from '../services/geminiService';

interface UIProps {
  onPhotoUpload: (file: File) => void;
  onPhotoGenerated: (url: string) => void;
  mode: AppMode;
}

export const UI: React.FC<UIProps> = ({ onPhotoUpload, onPhotoGenerated, mode }) => {
  const [isHidden, setIsHidden] = useState(false);
  const [showGenTools, setShowGenTools] = useState(false);
  
  // Generation State
  const [genPrompt, setGenPrompt] = useState('');
  const [genSize, setGenSize] = useState<ImageSize>('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [selectedFileForEdit, setSelectedFileForEdit] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') setIsHidden(prev => !prev);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Logic: If in Edit mode (which we can toggle), we set state, else direct upload
      if (showGenTools) {
          setSelectedFileForEdit(file);
          const reader = new FileReader();
          reader.onload = (ev) => setPreviewUrl(ev.target?.result as string);
          reader.readAsDataURL(file);
      } else {
          onPhotoUpload(file);
      }
    }
  };

  const handleGenerate = async () => {
    if (!genPrompt) return;
    setIsGenerating(true);
    setGenError(null);
    try {
      const url = await generateChristmasImage(genPrompt, genSize);
      onPhotoGenerated(url);
      setGenPrompt('');
      setShowGenTools(false);
    } catch (e) {
      setGenError("Failed to generate image.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = async () => {
      if (!editPrompt || !previewUrl) return;
      setIsEditing(true);
      setGenError(null);
      try {
          const url = await editImageWithGemini(previewUrl, editPrompt);
          onPhotoGenerated(url);
          setEditPrompt('');
          setSelectedFileForEdit(null);
          setPreviewUrl(null);
          setShowGenTools(false);
      } catch (e) {
          setGenError("Failed to edit image.");
      } finally {
          setIsEditing(false);
      }
  };

  return (
    <div className={`fixed inset-0 pointer-events-none z-10 transition-opacity duration-500 ${isHidden ? 'opacity-0' : 'opacity-100'}`}>
      {/* Header */}
      <div className="absolute top-8 left-0 right-0 text-center">
        <h1 className="font-cinzel text-6xl font-bold tracking-wider" style={{
          background: 'linear-gradient(to bottom, #ffffff, #d4af37)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 10px rgba(212, 175, 55, 0.5))'
        }}>
          Merry Christmas
        </h1>
        <p className="text-[#d4af37] font-cinzel mt-2 tracking-widest text-sm opacity-80">
          Current Mode: {mode}
        </p>
      </div>

      {/* Controls Container */}
      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center pointer-events-auto">
        
        {/* Tools Panel */}
        {showGenTools && (
           <div className="bg-black/80 backdrop-blur-md border border-[#d4af37] p-6 rounded-lg mb-6 w-96 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
               
               {/* Tab Switcher (Implied by UI layout) */}
               <div className="flex gap-4 mb-4 border-b border-[#d4af37]/30 pb-2">
                   <button onClick={() => {setSelectedFileForEdit(null); setPreviewUrl(null);}} className={`text-sm font-cinzel ${!selectedFileForEdit ? 'text-[#d4af37]' : 'text-gray-500'}`}>Generate New</button>
                   <button className={`text-sm font-cinzel ${selectedFileForEdit ? 'text-[#d4af37]' : 'text-gray-500'}`}>Edit Photo</button>
               </div>

               {!selectedFileForEdit ? (
                   // Generation UI
                   <div className="flex flex-col gap-3">
                       <input 
                         type="text" 
                         value={genPrompt}
                         onChange={(e) => setGenPrompt(e.target.value)}
                         placeholder="Describe a holiday image..."
                         className="bg-transparent border border-[#d4af37]/50 rounded px-3 py-2 text-[#fceea7] placeholder-[#d4af37]/30 focus:outline-none focus:border-[#d4af37]"
                       />
                       <select 
                         value={genSize} 
                         onChange={(e) => setGenSize(e.target.value as ImageSize)}
                         className="bg-black border border-[#d4af37]/50 text-[#d4af37] rounded px-2 py-1 text-sm w-full"
                       >
                           <option value="1K">1K Resolution</option>
                           <option value="2K">2K Resolution</option>
                           <option value="4K">4K Resolution</option>
                       </select>
                       <button 
                         onClick={handleGenerate}
                         disabled={isGenerating}
                         className="bg-[#d4af37]/20 hover:bg-[#d4af37]/40 text-[#d4af37] border border-[#d4af37] py-2 rounded font-cinzel transition-all"
                       >
                           {isGenerating ? 'Dreaming...' : 'Generate Magic'}
                       </button>
                   </div>
               ) : (
                   // Edit UI
                   <div className="flex flex-col gap-3">
                       <div className="w-full h-32 bg-gray-900 rounded flex items-center justify-center overflow-hidden border border-[#d4af37]/30">
                           {previewUrl && <img src={previewUrl} alt="Preview" className="h-full object-cover" />}
                       </div>
                       <input 
                         type="text" 
                         value={editPrompt}
                         onChange={(e) => setEditPrompt(e.target.value)}
                         placeholder="What to change? (e.g., 'Add snow')"
                         className="bg-transparent border border-[#d4af37]/50 rounded px-3 py-2 text-[#fceea7] placeholder-[#d4af37]/30 focus:outline-none focus:border-[#d4af37]"
                       />
                       <button 
                         onClick={handleEdit}
                         disabled={isEditing}
                         className="bg-[#d4af37]/20 hover:bg-[#d4af37]/40 text-[#d4af37] border border-[#d4af37] py-2 rounded font-cinzel transition-all"
                       >
                           {isEditing ? 'Editing...' : 'Apply Magic'}
                       </button>
                   </div>
               )}
               {genError && <p className="text-red-400 text-xs mt-2 text-center">{genError}</p>}
           </div>
        )}

        {/* Main Action Buttons */}
        <div className="flex gap-4">
            <div className="upload-wrapper relative group">
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                <button className="px-8 py-3 bg-black/30 backdrop-blur-md border border-[#d4af37] text-[#d4af37] font-cinzel tracking-wider hover:bg-[#d4af37] hover:text-black transition-all duration-300 rounded shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                    {showGenTools ? 'UPLOAD SOURCE' : 'ADD MEMORIES'}
                </button>
            </div>

            <button 
                onClick={() => setShowGenTools(!showGenTools)}
                className="px-8 py-3 bg-black/30 backdrop-blur-md border border-[#d4af37] text-[#d4af37] font-cinzel tracking-wider hover:bg-[#d4af37] hover:text-black transition-all duration-300 rounded shadow-[0_0_15px_rgba(212,175,55,0.3)]"
            >
                {showGenTools ? 'CLOSE AI TOOLS' : 'AI MAGIC'}
            </button>
        </div>

        <p className="text-[#d4af37] font-cinzel text-xs mt-4 opacity-60 tracking-widest">
            Press 'H' to Hide Controls
        </p>

        {/* Instructions */}
        <div className="absolute bottom-4 right-[-300px] w-64 text-left text-[#d4af37]/50 text-xs font-sans leading-relaxed pointer-events-none hidden md:block">
            Gestures:<br/>
            ✊ Fist: Tree Mode<br/>
            🖐️ Open Hand: Scatter Mode<br/>
            🤏 Pinch: Focus Photo
        </div>
      </div>
    </div>
  );
};

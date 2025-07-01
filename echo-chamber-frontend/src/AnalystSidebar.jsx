// src/AnalystSidebar.jsx

import React from 'react';

const sidebarStyles = {
  position: 'fixed',
  top: 0,
  right: 0,
  height: '100%',
  width: '350px',
  backgroundColor: 'rgba(20, 20, 20, 0.95)',
  backdropFilter: 'blur(10px)',
  borderLeft: '1px solid #444',
  color: 'white',
  padding: '25px',
  fontFamily: 'Inter, sans-serif',
  zIndex: 200,
  overflowY: 'auto',
  transform: 'translateX(100%)',
  transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
};

const visibleStyles = {
  transform: 'translateX(0%)',
};

const closeButtonStyles = {
  position: 'absolute',
  top: '15px',
  right: '15px',
  background: 'transparent',
  border: 'none',
  color: '#aaa',
  fontSize: '30px',
  cursor: 'pointer',
  transition: 'color 0.2s ease',
};

const loaderStyles = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100px',
    gap: '8px'
};

const dotStyles = {
    width: '10px',
    height: '10px',
    backgroundColor: '#00ffff',
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite ease-in-out'
};

export function AnalystSidebar({ isVisible, summary, isLoading, onClose }) {
  return (
    <div style={{ ...sidebarStyles, ...(isVisible ? visibleStyles : {}) }}>
      <button 
        onClick={onClose} 
        style={closeButtonStyles}
        onMouseOver={(e) => e.currentTarget.style.color = 'white'}
        onMouseOut={(e) => e.currentTarget.style.color = '#aaa'}
      >&times;</button>
      <h3 style={{ fontFamily: 'Orbitron, sans-serif', color: '#00ffff', letterSpacing: '1px' }}>AI ANALYST</h3>
      <hr style={{ borderColor: 'rgba(0, 255, 255, 0.2)', opacity: 0.5 }} />
      {isLoading ? (
        <div style={loaderStyles}>
            <div style={{...dotStyles, animationDelay: '0s'}}></div>
            <div style={{...dotStyles, animationDelay: '0.2s'}}></div>
            <div style={{...dotStyles, animationDelay: '0.4s'}}></div>
            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(0); opacity: 0.5; }
                    50% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
      ) : (
        <p style={{ lineHeight: '1.7', whiteSpace: 'pre-wrap', fontSize: '14px' }}>{summary}</p>
      )}
    </div>
  );
}
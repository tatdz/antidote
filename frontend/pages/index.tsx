// pages/index.tsx - SIMPLIFIED PRODUCTION FIX
import { useEffect, useState } from 'react';
import ImprovedDashboard from '../components/ImprovedDashboard';

export async function getServerSideProps() {
  return {
    props: {
      timestamp: Date.now(),
    },
  };
}

export default function Home({ timestamp }: { timestamp: number }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    console.log('✅ Client mounted - hydration complete');
    setIsClient(true);
    
    // Simple CSS check
    const checkCSS = () => {
      const body = document.body;
      const hasBgGray50 = getComputedStyle(body).backgroundColor.includes('249') || 
                         body.classList.contains('bg-gray-50');
      
      if (hasBgGray50) {
        console.log('✅ CSS appears to be loaded');
      } else {
        console.warn('⚠️ CSS may not be fully loaded');
      }
    };

    setTimeout(checkCSS, 100);
  }, []);

  // Show loading state during SSR and initial hydration
  if (!isClient) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f9fafb' // gray-50
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #f3f4f6',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading Antidote...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  console.log('🎯 Rendering ImprovedDashboard');
  return <ImprovedDashboard />;
}
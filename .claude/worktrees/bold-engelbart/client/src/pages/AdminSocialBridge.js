import React, { useState } from 'react';
import { Sparkles, RefreshCw, ExternalLink } from 'lucide-react';
import { useClientConfig } from '../context/AppContext';

const SOCIAL_AI_URLS = {
  hugheseysque: 'https://social.hugheseysque.au',
};

const AdminSocialBridge = () => {
  const { clientId } = useClientConfig();
  const url = SOCIAL_AI_URLS[clientId] || 'https://socialaistudio.au';
  const [key, setKey] = useState(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', margin: '-1.5rem', borderRadius: '0' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: '#111827',
        borderBottom: '1px solid #1f2937', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} color="#f59e0b" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Social AI Studio</span>
          <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>— powered by Penny Wise I.T</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setKey(k => k + 1)}
            title="Reload"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#9ca3af', borderRadius: 6 }}
          >
            <RefreshCw size={13} />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            style={{ display: 'flex', alignItems: 'center', padding: 6, color: '#9ca3af', borderRadius: 6 }}
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Iframe */}
      <iframe
        key={key}
        src={url}
        title="Social AI Studio"
        style={{ flex: 1, width: '100%', border: 'none', minHeight: 0 }}
        allow="clipboard-write; clipboard-read"
      />
    </div>
  );
};

export default AdminSocialBridge;

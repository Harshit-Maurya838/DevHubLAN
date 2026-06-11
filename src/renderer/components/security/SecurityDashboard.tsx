import React, { useEffect, useState } from 'react';
import { DeviceIdentity, SecurityEventLog, TrustStatus } from '../../../shared/trustTypes';

export const SecurityDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Identity' | 'Trust' | 'Logs'>('Identity');
  const [data, setData] = useState<{
    publicKey: string;
    fingerprint: string;
    trustedDevices: DeviceIdentity[];
    logs: SecurityEventLog[];
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const dashboardData = await window.api.getSecurityDashboardData();
    setData(dashboardData);
  };

  const updateTrust = async (fingerprint: string, status: TrustStatus) => {
    await window.api.setTrustStatus(fingerprint, status);
    fetchData(); // Refresh list
  };

  if (!data) return <div className="p-8 text-white">Loading Security Context...</div>;

  return (
    <div className="flex-1 bg-gray-900 text-white flex flex-col p-6 overflow-y-auto">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Security & Trust Dashboard
      </h1>

      <div className="flex gap-4 mb-6 border-b border-gray-800 pb-2">
        {['Identity', 'Trust', 'Logs'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
        {activeTab === 'Identity' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2 text-gray-200">Device Fingerprint</h2>
              <div className="bg-gray-900 p-4 rounded font-mono text-sm break-all text-indigo-400 border border-gray-700">
                {data.fingerprint}
              </div>
              <p className="text-xs text-gray-500 mt-2">This is the SHA-256 hash of your public key. Others can use this to verify your identity.</p>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-2 text-gray-200">RSA-4096 Public Key</h2>
              <div className="bg-gray-900 p-4 rounded font-mono text-xs overflow-y-auto max-h-64 whitespace-pre border border-gray-700 text-gray-400">
                {data.publicKey}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Trust' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-200">Discovered Devices</h2>
            <div className="space-y-4">
              {data.trustedDevices.length === 0 && <p className="text-gray-500 italic">No devices discovered yet.</p>}
              {data.trustedDevices.map(dev => (
                <div key={dev.fingerprint} className="bg-gray-900 border border-gray-700 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-lg">{dev.peerId}</div>
                    <div className="font-mono text-xs text-gray-500">{dev.fingerprint}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-bold rounded ${dev.status === 'TRUSTED' ? 'bg-green-900/50 text-green-400' : dev.status === 'BLOCKED' ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                      {dev.status}
                    </span>
                    <select 
                      value={dev.status}
                      onChange={(e) => updateTrust(dev.fingerprint, e.target.value as TrustStatus)}
                      className="bg-gray-800 border border-gray-600 text-sm rounded px-2 py-1"
                    >
                      <option value="UNKNOWN">Unknown</option>
                      <option value="TRUSTED">Trusted</option>
                      <option value="BLOCKED">Blocked</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Logs' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-200">Security Events</h2>
            <div className="space-y-2">
              {data.logs.length === 0 && <p className="text-gray-500 italic">No security events recorded.</p>}
              {data.logs.slice().reverse().map(log => (
                <div key={log.id} className="bg-gray-900 border border-gray-700 p-3 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-400 text-sm">{log.type}</span>
                    <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-gray-300">{log.details}</div>
                  {log.peerId && <div className="text-xs text-gray-500 mt-1">Peer: {log.peerId}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

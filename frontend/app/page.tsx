'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export default function Home() {
  const [mode, setMode] = useState<'choose' | 'nurse' | 'hospital' | 'connected'>('choose');
  const [nurseData, setNurseData] = useState({ license: '', specialty: '', location: '' });
  const [hospitalData, setHospitalData] = useState({ name: '', need: '' });
  const [userId, setUserId] = useState<string | null>(null);
  const [userType, setUserType] = useState<'nurse' | 'hospital' | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ nurses: 0, hospitals: 0, connections: 0 });

  // Load stats on mount
  useEffect(() => {
    fetch(`${API_URL}/api/stats`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, []);

  const handleNurseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Register nurse with backend
      const response = await fetch(`${API_URL}/api/nurse/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nurseData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserId(data.nurseId);
        setUserType('nurse');
        localStorage.setItem('userId', data.nurseId);
        localStorage.setItem('userType', 'nurse');
        
        // Get matches
        const matchResponse = await fetch(`${API_URL}/api/matches/nurse/${data.nurseId}`);
        const matchData = await matchResponse.json();
        
        if (matchData.success) {
          setMatches(matchData.matches);
        }
        
        setMode('connected');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Connection issue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleHospitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Register hospital need with backend
      const response = await fetch(`${API_URL}/api/hospital/need`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hospitalData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserId(data.hospitalId);
        setUserType('hospital');
        localStorage.setItem('userId', data.hospitalId);
        localStorage.setItem('userType', 'hospital');
        
        // Get matches
        const matchResponse = await fetch(`${API_URL}/api/matches/hospital/${data.hospitalId}`);
        const matchData = await matchResponse.json();
        
        if (matchData.success) {
          setMatches(matchData.matches);
        }
        
        setMode('connected');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Connection issue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (matchId: string) => {
    // Direct connection. No middlemen.
    try {
      const response = await fetch(`${API_URL}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nurseId: userType === 'nurse' ? userId : matchId,
          hospitalId: userType === 'hospital' ? userId : matchId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Connected! Your connection ID: ${data.connectionId}\n\nYou can now exchange contact information directly.`);
      }
    } catch (error) {
      console.error('Connection error:', error);
    }
  };

  // The Choose Screen - Two Buttons, One Decision
  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-6xl font-light mb-4 text-gray-900">
            ProConnect
          </h1>
          <p className="text-xl text-gray-600 mb-16">
            The last recruitment platform you'll ever need.
          </p>
          
          <div className="flex gap-8 justify-center">
            <button
              onClick={() => setMode('nurse')}
              className="group relative"
            >
              <div className="absolute inset-0 bg-blue-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-white border-2 border-blue-600 text-blue-600 px-12 py-8 rounded-2xl text-2xl font-medium hover:bg-blue-600 hover:text-white transition-all transform hover:scale-105">
                I Am a Nurse
              </div>
            </button>

            <button
              onClick={() => setMode('hospital')}
              className="group relative"
            >
              <div className="absolute inset-0 bg-green-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-white border-2 border-green-600 text-green-600 px-12 py-8 rounded-2xl text-2xl font-medium hover:bg-green-600 hover:text-white transition-all transform hover:scale-105">
                I Need Nurses
              </div>
            </button>
          </div>

          <p className="mt-16 text-sm text-gray-500">
            48-hour hiring. 30-second signup. Zero complexity.
          </p>
          
          {stats.nurses > 0 && (
            <p className="mt-4 text-xs text-gray-400">
              {stats.nurses} nurses • {stats.hospitals} hospitals • {stats.connections} connections made
            </p>
          )}
        </div>
      </div>
    );
  }

  // The Nurse Screen - 3 Fields, 30 Seconds
  if (mode === 'nurse') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-full max-w-md">
          <button
            onClick={() => setMode('choose')}
            className="mb-8 text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>

          <h2 className="text-4xl font-light mb-2 text-gray-900">
            Welcome, Healer
          </h2>
          <p className="text-gray-600 mb-8">
            30 seconds to your next opportunity.
          </p>

          <form onSubmit={handleNurseSubmit} className="space-y-6">
            <input
              type="text"
              placeholder="License Number"
              value={nurseData.license}
              onChange={(e) => setNurseData({...nurseData, license: e.target.value})}
              className="w-full px-4 py-4 text-lg border-b-2 border-gray-300 focus:border-blue-600 outline-none transition-colors"
              required
              autoFocus
            />

            <input
              type="text"
              placeholder="Specialty (ICU, ER, Med-Surg...)"
              value={nurseData.specialty}
              onChange={(e) => setNurseData({...nurseData, specialty: e.target.value})}
              className="w-full px-4 py-4 text-lg border-b-2 border-gray-300 focus:border-blue-600 outline-none transition-colors"
              required
            />

            <input
              type="text"
              placeholder="Preferred Location"
              value={nurseData.location}
              onChange={(e) => setNurseData({...nurseData, location: e.target.value})}
              className="w-full px-4 py-4 text-lg border-b-2 border-gray-300 focus:border-blue-600 outline-none transition-colors"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-xl text-xl font-medium hover:bg-blue-700 transition-colors transform hover:scale-[1.02] disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Find My Perfect Match'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            No forms. No resumes. Just connection.
          </p>
        </div>
      </div>
    );
  }

  // The Hospital Screen - Instant Matches
  if (mode === 'hospital') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-full max-w-md">
          <button
            onClick={() => setMode('choose')}
            className="mb-8 text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>

          <h2 className="text-4xl font-light mb-2 text-gray-900">
            Find Your Nurses
          </h2>
          <p className="text-gray-600 mb-8">
            48 hours to fully staffed.
          </p>

          <form onSubmit={handleHospitalSubmit} className="space-y-6">
            <input
              type="text"
              placeholder="Hospital Name"
              value={hospitalData.name}
              onChange={(e) => setHospitalData({...hospitalData, name: e.target.value})}
              className="w-full px-4 py-4 text-lg border-b-2 border-gray-300 focus:border-green-600 outline-none transition-colors"
              required
              autoFocus
            />

            <input
              type="text"
              placeholder="What do you need? (ICU Nurses, ER Night Shift...)"
              value={hospitalData.need}
              onChange={(e) => setHospitalData({...hospitalData, need: e.target.value})}
              className="w-full px-4 py-4 text-lg border-b-2 border-gray-300 focus:border-green-600 outline-none transition-colors"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-4 rounded-xl text-xl font-medium hover:bg-green-700 transition-colors transform hover:scale-[1.02] disabled:opacity-50"
            >
              {loading ? 'Finding Nurses...' : 'Show Me Available Nurses'}
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-3xl font-light text-gray-900 mb-2">$99/month</p>
            <p className="text-sm text-gray-600">Unlimited hiring. No per-hire fees.</p>
          </div>
        </div>
      </div>
    );
  }

  // The Connection Screen - Magic Happens
  if (mode === 'connected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="mb-8">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-600 to-green-600 rounded-full mx-auto animate-pulse"></div>
          </div>

          <h2 className="text-4xl font-light mb-4 text-gray-900">
            Perfect Matches Found
          </h2>

          <div className="bg-gray-50 rounded-2xl p-8 max-w-2xl mx-auto">
            <div className="space-y-4">
              {matches.map((match) => (
                <div key={match.id} className="bg-white rounded-xl p-6 flex justify-between items-center">
                  <div className="text-left">
                    <h3 className="text-xl font-medium text-gray-900">{match.name}</h3>
                    <p className="text-gray-600">{match.details}</p>
                    {match.matchScore && (
                      <p className="text-sm text-green-600 mt-1">Match Score: {match.matchScore}%</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleConnect(match.id)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Connect Now
                  </button>
                </div>
              ))}
              
              {matches.length === 0 && (
                <p className="text-center text-gray-500">No matches found yet. More nurses/hospitals joining soon!</p>
              )}
            </div>
          </div>

          <p className="mt-8 text-gray-600">
            No applications. No waiting. Just connect and hire.
          </p>

          <button
            onClick={() => setMode('choose')}
            className="mt-8 text-gray-500 hover:text-gray-700 underline"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  return null;
}
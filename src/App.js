import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { Gem, Users, MessageSquare, Send, Bot, TrendingUp, Target, Wind, CheckCircle, PlusCircle, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import i2usLogo from './i2us-logo.png'; // Import the logo directly

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// --- App Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = process.env.REACT_APP_FIREBASE_APP_ID;

// --- Main App Component ---
export default function App() {
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [session, setSession] = useState(null);
    const [partnerId, setPartnerId] = useState('');
    const [error, setError] = useState('');
    const [sessionLoading, setSessionLoading] = useState(false);
    const [activeView, setActiveView] = useState('chat'); // chat, dashboard

    // --- Authentication Effect ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setUserId(currentUser.uid);
            } else {
                try {
                    await signInAnonymously(auth);
                } catch (err) {
                    console.error("Authentication Error:", err);
                    setError("Failed to initialize user session. Please refresh.");
                }
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    const handleSetSession = (sessionData) => {
        setSession(sessionData);
        if (sessionData) {
            // Ensure session document exists before trying to access subcollections
            const sessionRef = doc(db, `/artifacts/${appId}/public/data/sessions`, sessionData.id);
            onSnapshot(sessionRef, (doc) => {
                if (!doc.exists()) {
                    setSession(null); // Session was deleted
                } else {
                    setSession({id: doc.id, ...doc.data()});
                }
            });
        }
    }

    // --- Session Management ---
    const createOrJoinSession = async (partnerUid = null) => {
        console.log("Attempting to create or join session...");
        if (!userId) {
            console.log("User ID not available, returning.");
            return;
        }
        setSessionLoading(true);
        setError('');

        try {
             console.log("Firestore path base:", `/artifacts/${appId}/public/data/sessions`);
             console.log("User ID for query:", userId);
             const sessionsRef = collection(db, `/artifacts/${appId}/public/data/sessions`);
             const q = query(sessionsRef, where('participants', 'array-contains', userId));
             const querySnapshot = await getDocs(q);

             let existingSession = null;
             querySnapshot.forEach(doc => {
                 const data = doc.data();
                 if (!partnerUid || data.participants.includes(partnerUid)) {
                     existingSession = { id: doc.id, ...data };
                 }
             });

             if(existingSession){
                 handleSetSession(existingSession);
                 return;
             }

            if (partnerUid) { // Join session logic (delegated to joinPartnerSession)
                 await joinPartnerSession();
            } else { // Create a new session
                console.log("Attempting to add new session with userId:", userId);
                const newSessionRef = await addDoc(collection(db, `/artifacts/${appId}/public/data/sessions`), {
                    participants: [userId],
                    createdAt: serverTimestamp(),
                    status: 'waiting',
                    cooldownUntil: null,
                });
                const newSessionData = { id: newSessionRef.id, participants: [userId], status: 'waiting', cooldownUntil: null };
                handleSetSession(newSessionData);
                console.log("New session created:", newSessionData.id);
            }
        } catch (err) {
            console.error("Session creation/joining error:", err);
            setError("Something went wrong. Please try again.");
        } finally {
            setSessionLoading(false);
            console.log("Session loading set to false.");
        }
    };
    
    const joinPartnerSession = async () => {
        if (!userId || !partnerId) return;
        setSessionLoading(true);
        setError('');
        
        try {
            const sessionsRef = collection(db, `/artifacts/${appId}/public/data/sessions`);
            const q = query(sessionsRef, where('participants', '==', [partnerId]), where('status', '==', 'waiting'));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const sessionDoc = querySnapshot.docs[0];
                await updateDoc(doc(db, `/artifacts/${appId}/public/data/sessions`, sessionDoc.id), {
                    participants: [partnerId, userId],
                    status: 'active'
                });
                const updatedSessionData = { id: sessionDoc.id, ...sessionDoc.data(), participants: [partnerId, userId], status: 'active' };
                handleSetSession(updatedSessionData);

            } else {
                setError("No waiting session found for this Partner ID. Please ensure the ID is correct and your partner has started a session.");
            }
        } catch (err) {
            console.error("Error joining session: ", err);
            setError("Failed to join the session. Please try again.");
        } finally {
            setSessionLoading(false);
        }
    };

    if (!isAuthReady) {
        return <LoadingScreen message="Warming up the algorithms of love..." />;
    }

    return (
        <div className="bg-gradient-to-br from-purple-100 to-pink-100 animate-gradient-shift min-h-screen font-sans text-gray-800">
            <Header userId={userId} />
            <main className="p-4 md:p-8 max-w-6xl mx-auto">
                {!session ? (
                    <SessionManager 
                        partnerId={partnerId}
                        setPartnerId={setPartnerId}
                        createSession={() => createOrJoinSession()}
                        joinSession={joinPartnerSession}
                        loading={sessionLoading}
                        error={error}
                    />
                ) : (
                    <>
                        <ViewSwitcher activeView={activeView} setActiveView={setActiveView} />
                        {activeView === 'chat' && <ChatInterface session={session} userId={userId} setSession={handleSetSession} />}
                        {activeView === 'dashboard' && <Dashboard session={session} userId={userId} />}
                    </>
                )}
            </main>
            <Footer />
        </div>
    );
}

// --- UI Components ---

function Header({ userId }) {
    return (
        <header className="bg-white shadow-sm p-4 sticky top-0 z-20">
            <div className="max-w-6xl mx-auto flex justify-between items-center">
                <div className="flex items-center space-x-8">
                    <img src={i2usLogo} alt="I2Us Logo" className="h-48 w-auto" />
                    <h2 className="text-6xl font-extrabold text-gray-700 text-gradient-tagline">Say &lt;Mean&gt;</h2>
                </div>
                {userId && (
                     <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                        Your ID: <span className="font-mono bg-gray-200 px-1 rounded">{userId}</span>
                    </div>
                )}
            </div>
        </header>
    );
}

function ViewSwitcher({ activeView, setActiveView }) {
    const commonClasses = "px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center space-x-2";
    const activeClasses = "bg-pink-500 text-white shadow";
    const inactiveClasses = "bg-white text-gray-600 hover:bg-gray-200";

    return (
        <div className="mb-6 bg-gray-200 p-1 rounded-xl flex justify-center space-x-2 max-w-xs mx-auto">
            <button onClick={() => setActiveView('chat')} className={`${commonClasses} ${activeView === 'chat' ? activeClasses : inactiveClasses}`}>
                <MessageSquare size={18} /><span>Chat</span>
            </button>
            <button onClick={() => setActiveView('dashboard')} className={`${commonClasses} ${activeView === 'dashboard' ? activeClasses : inactiveClasses}`}>
                <TrendingUp size={18} /><span>Dashboard</span>
            </button>
        </div>
    );
}

function ChatInterface({ session, userId, setSession }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isMyTurn, setIsMyTurn] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [cooldownTime, setCooldownTime] = useState(0);
    const messagesEndRef = useRef(null);

    // Cooldown Timer Effect
    useEffect(() => {
        if (session.cooldownUntil) {
            const updateTimer = () => {
                const now = Date.now();
                const cooldownEnd = session.cooldownUntil.toDate().getTime();
                const secondsLeft = Math.ceil((cooldownEnd - now) / 1000);
                if (secondsLeft > 0) {
                    setCooldownTime(secondsLeft);
                } else {
                    setCooldownTime(0);
                    // Reset cooldown in Firestore
                    const sessionRef = doc(db, `/artifacts/${appId}/public/data/sessions`, session.id);
                    updateDoc(sessionRef, { cooldownUntil: null });
                }
            };
            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        }
    }, [session.cooldownUntil, session.id]);

    // Message Listener Effect
    useEffect(() => {
        if (!session?.id) return;
        
        const messagesRef = collection(db, `/artifacts/${appId}/public/data/sessions/${session.id}/messages`);
        const q = query(messagesRef);

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => a.timestamp?.toMillis() - b.timestamp?.toMillis());
            
            setMessages(msgs);

            const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            if (!lastMessage) {
                setIsMyTurn(session.participants[0] === userId);
            } else {
                 setIsMyTurn(lastMessage.uid !== userId && lastMessage.type === 'user');
            }
            
            if (msgs.length >= 2) {
                const lastTwo = msgs.slice(-2);
                const areBothUserMessages = lastTwo.every(m => m.type === 'user');
                const areFromDifferentUsers = lastTwo[0].uid !== lastTwo[1].uid;
                const lastMessageIsNotAnalyzed = !lastTwo[1].analysisDone;

                if (areBothUserMessages && areFromDifferentUsers && lastMessageIsNotAnalyzed) {
                    analyzeExchange(lastTwo);
                }
            }
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, (err) => {
            console.error("Error fetching messages:", err);
        });

        return () => unsubscribe();
    }, [session.id, userId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !isMyTurn || isSending || cooldownTime > 0) return;

        setIsSending(true);
        
        // --- Get sentiment before sending ---
        const sentiment = await getSentiment(newMessage);

        const messageData = {
            text: newMessage,
            uid: userId,
            timestamp: serverTimestamp(),
            type: 'user',
            sentiment: sentiment, // Store sentiment score
            analysisDone: false,
        };

        try {
            await addDoc(collection(db, `/artifacts/${appId}/public/data/sessions/${session.id}/messages`), messageData);
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };
    
    const getSentiment = async (text) => {
        const prompt = `Analyze the sentiment of this text on a scale of -1 (very negative) to 1 (very positive). Respond with ONLY the number. Text: "${text}"`;
        try {
            const response = await callGemini(prompt);
            const score = parseFloat(response);
            return isNaN(score) ? 0 : Math.max(-1, Math.min(1, score)); // Clamp between -1 and 1
        } catch (error) {
            console.error("Sentiment analysis failed:", error);
            return 0; // Neutral on failure
        }
    };

    const callGemini = async (prompt) => {
        let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API call failed: ${response.status}`);
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text;
        }
        return "Analysis could not be completed.";
    };

    const analyzeExchange = async (exchange) => {
        if (isAnalyzing) return;
        setIsAnalyzing(true);
    
        const [message1, message2] = exchange;
        const batch = writeBatch(db);
    
        // Mark messages as being analyzed
        const msg1Ref = doc(db, `/artifacts/${appId}/public/data/sessions/${session.id}/messages`, message1.id);
        const msg2Ref = doc(db, `/artifacts/${appId}/public/data/sessions/${session.id}/messages`, message2.id);
        batch.update(msg1Ref, { analysisDone: true });
        batch.update(msg2Ref, { analysisDone: true });
    
        try {
            const combinedSentiment = (message1.sentiment + message2.sentiment) / 2;
            let prompt;
    
            if (combinedSentiment < -0.5) {
                // Cooldown protocol
                const cooldownMinutes = 5;
                const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);
                const sessionRef = doc(db, `/artifacts/${appId}/public/data/sessions`, session.id);
                batch.update(sessionRef, { cooldownUntil });
    
                prompt = `The conversation has become very heated (sentiment: ${combinedSentiment.toFixed(2)}). Provide a short, calming message (under 50 words) to both partners, suggesting a ${cooldownMinutes}-minute cool-down period. Also, provide a simple, 1-minute breathing exercise they can do. Start with "Let's pause and breathe." Format the exercise with clear steps.`;
            } else {
                // Standard analysis
                prompt = `As a relationship counselor, analyze this exchange. Sentiment scores are ${message1.sentiment.toFixed(2)} and ${message2.sentiment.toFixed(2)}.
                Partner 1: "${message1.text}"
                Partner 2: "${message2.text}"
                Provide a concise, gentle insight (under 150 words). If the sentiment is low, suggest a relevant communication exercise from this list: [Active Listening, 'I Feel' Statements, Validating Feelings]. Start with "Insight:" and if suggesting an exercise, end with "Suggestion: You might find the [Exercise Name] exercise helpful. You can find it in your dashboard."`;
            }
    
            const analysisText = await callGemini(prompt);
            
            const analysisMessage = {
                text: analysisText,
                uid: 'ai-counselor',
                timestamp: serverTimestamp(),
                type: 'analysis',
                sentiment: combinedSentiment
            };
            const analysisRef = doc(collection(db, `/artifacts/${appId}/public/data/sessions/${session.id}/messages`));
            batch.set(analysisRef, analysisMessage);
            
            await batch.commit();
    
        } catch (error) {
            console.error("Error during analysis or batch commit:", error);
            // Rollback is not needed for batch writes, but we should log the error.
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="flex flex-col h-[75vh] bg-white rounded-lg shadow-xl animate-fade-in">
             <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                <h3 className="font-semibold text-gray-700">Your Conversation</h3>
                <div className="flex items-center space-x-2">
                     {isAnalyzing ? (
                        <>
                          <Bot className="h-5 w-5 text-blue-500 animate-spin" />
                          <span className="text-sm text-blue-500">Analyzing...</span>
                        </>
                    ) : (
                        isMyTurn && cooldownTime <= 0 ?
                           <span className="text-sm text-green-600 font-semibold">Your Turn</span>
                         : !isMyTurn && cooldownTime <= 0 ? <span className="text-sm text-gray-500">Partner's Turn</span> : null
                    )}
                </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-gray-100">
                {messages.map((msg) => (
                    <Message key={msg.id} msg={msg} currentUserId={userId} />
                ))}
                 <div ref={messagesEndRef} />
            </div>

            {cooldownTime > 0 ? (
                <CooldownNotice time={cooldownTime} />
            ) : (
                 <div className="p-4 border-t bg-white rounded-b-lg">
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value.slice(0, 200))}
                            placeholder={isMyTurn ? "Your message..." : "Waiting for partner..."}
                            className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-pink-400 disabled:bg-gray-100"
                            disabled={!isMyTurn || isSending}
                        />
                        <button type="submit" disabled={!isMyTurn || isSending || !newMessage.trim()} className="bg-pink-500 text-white p-3 rounded-full hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50 disabled:bg-pink-300 disabled:cursor-not-allowed transition duration-300">
                            <Send className="h-5 w-5" />
                        </button>
                    </form>
                    <p className="text-xs text-right text-gray-400 mt-1 pr-16">{newMessage.length}/200</p>
                </div>
            )}
        </div>
    );
}

function CooldownNotice({ time }) {
    return (
        <div className="p-4 bg-yellow-100 border-t-4 border-yellow-400 text-center">
            <div className="flex justify-center items-center space-x-2">
                <Wind className="h-6 w-6 text-yellow-600" />
                <h4 className="font-bold text-yellow-800">Cool-Down Period Active</h4>
            </div>
            <p className="text-yellow-700 mt-2">
                For a more productive conversation, the chat is paused.
            </p>
            <p className="text-2xl font-mono font-bold text-yellow-900 my-2">
                {`${Math.floor(time / 60)}`.padStart(2, '0')}:{`${time % 60}`.padStart(2, '0')}
            </p>
            <p className="text-sm text-gray-600">Take this time to reflect or try a breathing exercise.</p>
        </div>
    );
}

function Dashboard({ session, userId }) {
    const [messages, setMessages] = useState([]);
    const [goals, setGoals] = useState([]);
    const [newGoal, setNewGoal] = useState('');

    useEffect(() => {
        const messagesUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/sessions/${session.id}/messages`), (snap) => {
            const msgs = snap.docs.map(d => ({...d.data(), id: d.id}))
                            .filter(m => m.sentiment != null)
                            .sort((a,b) => a.timestamp?.toMillis() - b.timestamp?.toMillis());
            setMessages(msgs);
        });

        const goalsUnsub = onSnapshot(collection(db, `/artifacts/${appId}/public/data/sessions/${session.id}/goals`), (snap) => {
            const goalsData = snap.docs.map(d => ({...d.data(), id: d.id}))
                                 .sort((a,b) => a.createdAt?.toMillis() - b.createdAt?.toMillis());
            setGoals(goalsData);
        });

        return () => {
            messagesUnsub();
            goalsUnsub();
        };
    }, [session.id]);
    
    const chartData = messages.map(msg => ({
        name: msg.timestamp?.toDate().toLocaleTimeString() || '',
        sentiment: msg.sentiment,
        user: msg.uid === userId ? 'You' : 'Partner',
        counselor: msg.uid === 'ai-counselor' ? msg.sentiment : null,
    }));
    
    const addGoal = async () => {
        if (!newGoal.trim()) return;
        await addDoc(collection(db, `/artifacts/${appId}/public/data/sessions/${session.id}/goals`), {
            text: newGoal,
            completed: false,
            createdAt: serverTimestamp(),
            createdBy: userId
        });
        setNewGoal('');
    };

    const toggleGoal = async (goalId, currentStatus) => {
        await updateDoc(doc(db, `/artifacts/${appId}/public/data/sessions/${session.id}/goals`, goalId), {
            completed: !currentStatus
        });
    };
    
    const deleteGoal = async (goalId) => {
         await deleteDoc(doc(db, `/artifacts/${appId}/public/data/sessions/${session.id}/goals`, goalId));
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <SentimentChart data={chartData} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <SharedGoals goals={goals} newGoal={newGoal} setNewGoal={setNewGoal} addGoal={addGoal} toggleGoal={toggleGoal} deleteGoal={deleteGoal} />
                <CommunicationExercises />
            </div>
        </div>
    );
}

const sentimentDataFormatter = (number) => {
  if(number > 0.5) return 'Very Positive';
  if(number > 0.1) return 'Positive';
  if(number > -0.1) return 'Neutral';
  if(number > -0.5) return 'Negative';
  return 'Very Negative';
}

function SentimentChart({ data }) {
    return (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><TrendingUp className="mr-2 text-pink-500"/>Conversation Sentiment Flow</h3>
             <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{fontSize: 12}} />
                    <YAxis domain={[-1, 1]} tickFormatter={sentimentDataFormatter} tick={{fontSize: 12}} />
                    <Tooltip
                        contentStyle={{backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '0.5rem', border: '1px solid #ddd'}}
                        labelStyle={{fontWeight: 'bold', color: '#333'}}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="sentiment" stroke="#ec4899" strokeWidth={2} dot={{r: 4}} name="Message Sentiment" />
                    <Line type="monotone" dataKey="counselor" stroke="#3b82f6" strokeWidth={1} strokeDasharray="5 5" name="AI Insight Tone" />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

function SharedGoals({ goals, newGoal, setNewGoal, addGoal, toggleGoal, deleteGoal }) {
    return (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Target className="mr-2 text-green-500"/>Our Shared Goals</h3>
            <div className="flex space-x-2 mb-4">
                <input 
                    type="text"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    placeholder="Add a new goal..."
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <button onClick={addGoal} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition"><PlusCircle size={20}/></button>
            </div>
            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {goals.map(goal => (
                    <li key={goal.id} className="flex items-center justify-between group bg-gray-50 p-2 rounded-lg">
                        <div className="flex items-center">
                            <button onClick={() => toggleGoal(goal.id, goal.completed)} className="mr-3">
                                <CheckCircle size={24} className={goal.completed ? 'text-green-500' : 'text-gray-300 hover:text-green-400'} />
                            </button>
                            <span className={`text-sm ${goal.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{goal.text}</span>
                        </div>
                        <button onClick={() => deleteGoal(goal.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

const exercises = [
    {
        title: "Active Listening",
        icon: "ear",
        description: "One partner speaks for 3 minutes about their day or feelings. The other listens without interrupting, then summarizes what they heard and how they think their partner feels.",
    },
    {
        title: "'I Feel' Statements",
        icon: "heart",
        description: "Practice expressing needs and feelings without blaming. Start sentences with 'I feel...' instead of 'You always...'. For example, 'I feel lonely when...' instead of 'You never spend time with me.'",
    },
    {
        title: "Validating Feelings",
        icon: "hug",
        description: "Acknowledge your partner's feelings, even if you don't agree. Use phrases like, 'I can see why you would feel that way,' or 'It makes sense that you're upset about that.'",
    }
];

function CommunicationExercises() {
    return (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                 <Bot className="mr-2 text-blue-500" /> Suggested Exercises
            </h3>
            <div className="space-y-4">
                {exercises.map(ex => (
                    <div key={ex.title} className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                        <h4 className="font-bold text-blue-800">{ex.title}</h4>
                        <p className="text-sm text-blue-700 mt-1">{ex.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function LoadingScreen({ message }) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
            <Gem className="text-pink-500 h-16 w-16 animate-pulse" />
            <p className="mt-4 text-gray-600">{message}</p>
        </div>
    );
}

function SessionManager({ partnerId, setPartnerId, createSession, joinSession, loading, error }) {
     return (
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg animate-fade-in">
            <div className="text-center">
                <Users className="mx-auto h-12 w-12 text-pink-400" />
                <h2 className="mt-4 text-2xl font-semibold text-gray-800">Welcome to Your Private Space</h2>
                <p className="mt-2 text-gray-600">Securely connect with your partner to begin your journey.</p>
            </div>
            
            <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <h3 className="font-bold text-blue-800">How to Connect:</h3>
                <ol className="list-decimal list-inside mt-2 text-sm text-blue-700 space-y-1">
                    <li><strong>One partner starts a session.</strong> This generates your unique ID.</li>
                    <li>Share this ID with your partner.</li>
                    <li><strong>The other partner pastes the ID</strong> and clicks "Join Session".</li>
                </ol>
            </div>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="flex flex-col items-center p-6 bg-gray-50 rounded-lg border">
                    <h3 className="text-lg font-semibold text-gray-700">Start a New Session</h3>
                    <p className="mt-2 text-sm text-gray-500 text-center">Generate an ID to share with your partner.</p>
                    <button onClick={createSession} disabled={loading} className="mt-4 w-full bg-pink-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-50 transition duration-300 disabled:bg-pink-300">
                        {loading ? 'Creating...' : 'Create Session'}
                    </button>
                </div>

                <div className="flex flex-col items-center p-6 bg-gray-50 rounded-lg border">
                    <h3 className="text-lg font-semibold text-gray-700">Join Your Partner</h3>
                    <p className="mt-2 text-sm text-gray-500 text-center">Enter the ID your partner shared with you.</p>
                    <input
                        type="text"
                        value={partnerId}
                        onChange={(e) => setPartnerId(e.target.value)}
                        placeholder="Enter Partner's ID"
                        className="mt-4 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400"
                    />
                    <button onClick={joinSession} disabled={loading || !partnerId} className="mt-2 w-full bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition duration-300 disabled:bg-green-300">
                        {loading ? 'Joining...' : 'Join Session'}
                    </button>
                </div>
            </div>
            {error && <p className="mt-6 text-center text-red-500 bg-red-100 p-3 rounded-lg">{error}</p>}
        </div>
    );
}

function Message({ msg, currentUserId }) {
    const isCurrentUser = msg.uid === currentUserId;

    if (msg.type === 'analysis' || msg.type === 'error') {
        const isCooldown = msg.text.toLowerCase().includes('pause and breathe');
        return (
            <div className={`my-4 flex items-start space-x-3 justify-center animate-fade-in`}>
                <div className={`p-2 rounded-full ${isCooldown ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                    <Bot className={`h-6 w-6 ${isCooldown ? 'text-yellow-600' : 'text-blue-500'}`} />
                </div>
                <div className={`p-3 rounded-lg max-w-md ${isCooldown ? 'bg-yellow-50' : 'bg-blue-50'}`}>
                     <p className={`text-sm whitespace-pre-wrap ${isCooldown ? 'text-yellow-900' : 'text-blue-800'}`}>{msg.text}</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`flex my-2 animate-fade-in ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-2xl max-w-sm md:max-w-md shadow-sm ${isCurrentUser ? 'bg-pink-500 text-white rounded-br-none' : 'bg-white text-gray-800 border rounded-bl-none'}`}>
                <p className="text-sm">{msg.text}</p>
            </div>
        </div>
    );
}

function Footer() {
    return (
        <footer className="text-center p-4 mt-8 text-xs text-gray-500">
            <p>Built with 400 years of love and a PhD in Psychology.</p>
            <p>&copy; 2025 i2us. All Rights Reserved.</p>
        </footer>
    );
} 
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User, Loader2 } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { chatbotService } from '../../services/chatbotService';
import '../../Style/Chatbot.css';

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [userName, setUserName] = useState('');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Predefined responses for common questions
    const predefinedResponses = {
        'course': {
            keywords: ['course', 'lesson', 'module', 'learning', 'study', 'progress'],
            response: "I can help you with your courses! You can view your courses in the 'My Courses' tab. Each course has modules and lessons that you can complete to track your progress. Is there a specific course you'd like help with?"
        },
        'assignment': {
            keywords: ['assignment', 'homework', 'task', 'due', 'deadline'],
            response: "I can help you with assignments! Check your dashboard for pending assignments. You can also ask me specific questions about your coursework, and I'll do my best to help you understand the concepts."
        },
        'progress': {
            keywords: ['progress', 'completion', 'percentage', 'how much', 'done'],
            response: "Your progress is tracked automatically as you complete lessons and modules. You can see your overall progress in the dashboard charts and individual course progress in the 'My Courses' section."
        },
        'certificate': {
            keywords: ['certificate', 'certification', 'completion', 'award'],
            response: "Certificates are awarded when you complete courses. You can view your earned certificates in the dashboard. Keep learning to earn more certifications!"
        },
        'technical': {
            keywords: ['error', 'bug', 'problem', 'issue', 'not working', 'broken'],
            response: "I'm here to help with technical issues! Please describe the problem you're experiencing, and I'll guide you through the solution or connect you with support if needed."
        },
        'general': {
            keywords: ['hello', 'hi', 'help', 'what can you do'],
            response: "Hello! I'm your learning assistant. I can help you with:\n• Course information and progress\n• Assignment questions\n• Technical support\n• Learning tips and guidance\n\nWhat would you like to know?"
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUser(user);
                // Clear previous chat history when user logs in
                setMessages([]);
                // Do NOT load chat history here if the intent is to clear it on login.
                // Chat history will still be saved to Firebase, but not displayed on login.
            } else {
                // Clear messages if user logs out
                setMessages([]);
                setUser(null);
            }
        });

        return () => unsubscribe();
    }, []);

    const loadChatHistory = (userId) => {
        const q = query(
            collection(db, 'users', userId, 'chatbot'),
            orderBy('timestamp', 'desc'),
            limit(20)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chatMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate()
            })).reverse();
            setMessages(chatMessages);
        });

        return unsubscribe;
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const getResponseType = (message) => {
        const lowerMessage = message.toLowerCase();
        
        for (const [type, config] of Object.entries(predefinedResponses)) {
            if (config.keywords.some(keyword => lowerMessage.includes(keyword))) {
                return type;
            }
        }
        return 'general';
    };

    const generateResponse = async (userMessage) => {
        if (!user) return predefinedResponses.general.response;
        
        try {
            // Use the chatbot service for contextual responses
            const contextualResponse = await chatbotService.generateContextualResponse(user.uid, userMessage);
            return contextualResponse;
        } catch (error) {
            console.error('Error generating contextual response:', error);
            // Fallback to predefined responses
            const responseType = getResponseType(userMessage);
            return predefinedResponses[responseType].response;
        }
    };

    const sendMessage = async () => {
        if (!inputMessage.trim() || !user) return;

        const userMessage = inputMessage.trim();
        setInputMessage('');
        setIsLoading(true);

        // Add user message to chat
        const userMsg = {
            text: userMessage,
            sender: 'user',
            timestamp: new Date(),
            userName: userName || 'Fresher'
        };

        setMessages(prev => [...prev, userMsg]);

        // Save user message to Firebase
        try {
            await addDoc(collection(db, 'users', user.uid, 'chatbot'), {
                text: userMessage,
                sender: 'user',
                timestamp: serverTimestamp(),
                userName: userName || 'Fresher'
            });
        } catch (error) {
            console.error('Error saving user message:', error);
        }

        // Simulate typing delay
        setTimeout(async () => {
            const botResponse = await generateResponse(userMessage);
            
            const botMsg = {
                text: botResponse,
                sender: 'bot',
                timestamp: new Date(),
                userName: 'HexaBot'
            };

            setMessages(prev => [...prev, botMsg]);

            // Save bot response to Firebase
            try {
                await addDoc(collection(db, 'users', user.uid, 'chatbot'), {
                    text: botResponse,
                    sender: 'bot',
                    timestamp: serverTimestamp(),
                    userName: 'HexaBot'
                });
            } catch (error) {
                console.error('Error saving bot message:', error);
            }

            setIsLoading(false);
        }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const toggleChatbot = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    return (
        <>
            {/* Chatbot Toggle Button */}
            <button 
                className={`chatbot-toggle ${isOpen ? 'active' : ''}`}
                onClick={toggleChatbot}
                title="Ask me anything!"
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </button>

            {/* Chatbot Window */}
            {isOpen && (
                <div className="chatbot-container">
                    {/* Header */}
                    <div className="chatbot-header">
                        <div className="chatbot-header-content">
                            <div className="bot-avatar">
                                <Bot size={20} />
                            </div>
                            <div>
                                <h3>HexaBot</h3>
                                <p>Your Learning Assistant</p>
                            </div>
                        </div>
                        <button className="close-btn" onClick={toggleChatbot}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="chatbot-messages">
                        {messages.length === 0 && (
                            <div className="welcome-message">
                                <div className="welcome-content">
                                    <Bot size={40} />
                                    <h4>Hello! I'm HexaBot 👋</h4>
                                    <p>I'm here to help you with your learning journey. Ask me anything about:</p>
                                    <ul>
                                        <li>📚 Your courses and progress</li>
                                        <li>📝 Assignments and deadlines</li>
                                        <li>🎯 Learning tips and guidance</li>
                                        <li>🔧 Technical support</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                        
                        {messages.map((message, index) => (
                            <div 
                                key={index} 
                                className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
                            >
                                <div className="message-avatar">
                                    {message.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                                </div>
                                <div className="message-content">
                                    <div className="message-text">
                                        {message.text.split('\n').map((line, i) => (
                                            <p key={i}>{line}</p>
                                        ))}
                                    </div>
                                    <div className="message-time">
                                        {message.timestamp?.toLocaleTimeString([], { 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {isLoading && (
                            <div className="message bot-message">
                                <div className="message-avatar">
                                    <Bot size={16} />
                                </div>
                                <div className="message-content">
                                    <div className="typing-indicator">
                                        <Loader2 size={16} className="spinning" />
                                        <span>HexaBot is typing...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="chatbot-input">
                        <div className="input-container">
                            <textarea
                                ref={inputRef}
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask me anything about your courses, assignments, or learning..."
                                rows={1}
                                disabled={isLoading}
                            />
                            <button 
                                onClick={sendMessage}
                                disabled={!inputMessage.trim() || isLoading}
                                className="send-btn"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                        <div className="input-hint">
                            Press Enter to send, Shift+Enter for new line
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Chatbot; 
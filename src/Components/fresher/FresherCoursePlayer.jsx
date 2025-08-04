import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import '../../Style/FresherCoursePlayer.css';

const FresherCoursePlayer = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState(null);
    const [currentLectureIndex, setCurrentLectureIndex] = useState(0);
    const [progress, setProgress] = useState(0); // New state for progress
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [isSidebarHidden, setIsSidebarHidden] = useState(false);
    const [showCongratulations, setShowCongratulations] = useState(false); // New state for congratulations animation
    const [showAssessmentUnlocked, setShowAssessmentUnlocked] = useState(false); // New state for assessment unlocked message

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    const courseDocRef = doc(db, 'users', currentUser.uid, 'courses', courseId);
                    const courseDocSnap = await getDoc(courseDocRef);

                    if (courseDocSnap.exists()) {
                        const courseData = { id: courseDocSnap.id, ...courseDocSnap.data() };
                        setCourse(courseData);
                        // Set initial lecture index and progress from saved data
                        setCurrentLectureIndex(courseData.currentLectureIndex || 0);
                        setProgress(courseData.progress || 0);
                    } else {
                        console.error("Course not found!");
                        navigate('/fresher/my-courses'); // Redirect if course not found
                    }
                } catch (error) {
                    console.error("Error fetching course:", error);
                    navigate('/fresher/my-courses');
                } finally {
                    setLoading(false);
                }
            } else {
                // Not authenticated, redirect to login
                navigate('/login');
            }
        });

        return () => unsubscribeAuth();
    }, [courseId, navigate]);

    useEffect(() => {
        // Update progress in Firestore whenever currentLectureIndex changes
        const updateCourseProgress = async () => {
            if (user && course && course.lectures) {
                const newProgress = Math.min(((currentLectureIndex + 1) / course.lectures.length) * 100, 100);
                setProgress(newProgress);
                const courseDocRef = doc(db, 'users', user.uid, 'courses', courseId);
                try {
                    await updateDoc(courseDocRef, {
                        currentLectureIndex: currentLectureIndex,
                        progress: newProgress,
                        completed: newProgress === 100 // Mark as completed if 100%
                    });
                } catch (error) {
                    console.error("Error updating course progress:", error);
                }
            }
        };
        updateCourseProgress();
    }, [currentLectureIndex, course, user, courseId]);

    const handleNextLecture = () => {
        if (course && currentLectureIndex < course.lectures.length - 1) {
            setCurrentLectureIndex(prevIndex => prevIndex + 1);
        }
    };

    const handleFinishCourse = async () => {
        if (user && course) {
            const courseDocRef = doc(db, 'users', user.uid, 'courses', courseId);
            try {
                await updateDoc(courseDocRef, {
                    currentLectureIndex: course.lectures.length - 1,
                    progress: 100,
                    completed: true
                });
                setShowCongratulations(true); // Show congratulations animation
                setTimeout(() => {
                    setShowCongratulations(false); // Hide after a delay
                    setShowAssessmentUnlocked(true); // Show assessment unlocked message
                    setTimeout(() => {
                        setShowAssessmentUnlocked(false); // Hide assessment unlocked message after a delay
                        navigate('/fresher/my-courses'); // Navigate after all animations
                    }, 3000); // 3 seconds for assessment unlocked message
                }, 3000); // 3 seconds for congratulations animation

                // Add the completed course to the user's completedCourses collection
                const completedCourseRef = doc(db, 'users', user.uid, 'completedCourses', courseId);
                await setDoc(completedCourseRef, { 
                    courseId: courseId, 
                    completedAt: new Date(),
                    title: course.title // Store course title for display in dashboard
                }, { merge: true });

            } catch (error) {
                console.error("Error marking course as finished:", error);
                alert('Failed to mark course as finished. Please try again.');
            }
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading course...</p>
            </div>
        );
    }

    if (!course) {
        return <div className="error-message">Course not available.</div>;
    }

    const currentLecture = course.lectures[currentLectureIndex];

    return (
        <div className={`fresher-course-player ${isSidebarHidden ? 'sidebar-hidden' : ''}`}>
            {showCongratulations && (
                <div className="congratulations-overlay">
                    <div className="congratulations-message">
                        <h2>Congratulations!</h2>
                        <p>You have successfully completed the course!</p>
                    </div>
                </div>
            )}
            {showAssessmentUnlocked && (
                <div className="congratulations-overlay">
                    <div className="congratulations-message">
                        <h2>Assessment Unlocked!</h2>
                        <p>A new assessment related to this course is now available.</p>
                    </div>
                </div>
            )}
            <div className="course-sidebar">
                <h3>{course.title}</h3>
                <div className="lectures-list">
                    {course.lectures.map((lecture, index) => (
                        <div 
                            key={lecture.id || index} 
                            className={`sidebar-lecture-item ${index === currentLectureIndex ? 'active' : ''}`}
                            onClick={() => setCurrentLectureIndex(index)}
                        >
                            <span>{index + 1}. {lecture.title}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="video-player-section">
                <button 
                    className="toggle-sidebar-btn" 
                    onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                >
                    {isSidebarHidden ? 'Show Sidebar' : 'Hide Sidebar'}
                </button>
                {currentLecture && currentLecture.videoUrl ? (
                    <video controls autoPlay key={currentLecture.videoUrl} className="main-video-player">
                        <source src={currentLecture.videoUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>
                ) : (
                    <div className="no-video-placeholder">
                        No video available for this lecture.
                    </div>
                )}
                <div className="lecture-info">
                    <h2>{currentLecture?.title}</h2>
                    <p>{currentLecture?.description}</p>
                </div>
                <div className="player-controls">
                    {currentLectureIndex < course.lectures.length - 1 && (
                        <button className="next-lesson-btn" onClick={handleNextLecture}>
                            Next Lesson
                        </button>
                    )}
                    {currentLectureIndex === course.lectures.length - 1 && (
                        <button className="finish-course-btn" onClick={handleFinishCourse}>
                            Finish Course
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FresherCoursePlayer;

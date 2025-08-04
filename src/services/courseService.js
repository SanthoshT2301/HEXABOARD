import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    writeBatch,
    setDoc,
    getDoc
} from 'firebase/firestore';

// Helper function to generate a random password
function generatePassword(length = 10) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let password = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
}

export const courseService = {
    async uploadFile(file, path) {
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    },

    async addCourse(courseData, assignment) {
        try {
            if (courseData.thumbnail && courseData.thumbnail instanceof File) {
                courseData.thumbnailUrl = await this.uploadFile(
                    courseData.thumbnail,
                    `thumbnails/${Date.now()}_${courseData.thumbnail.name}`
                );
                delete courseData.thumbnail;
            }

            const lectures = await Promise.all(courseData.lectures.map(async (lecture) => {
                if (lecture.video instanceof File) {
                    const videoUrl = await this.uploadFile(
                        lecture.video,
                        `videos/lectures/${Date.now()}_${lecture.video.name}`
                    );
                    return { ...lecture, videoUrl, video: null };
                }
                return lecture;
            }));

            const finalCourseData = { ...courseData, lectures };

            if (assignment.mode === 'individual') {
                return this.addCourseForFresher(assignment.id, finalCourseData);
            } else if (assignment.mode === 'department') {
                return this.bulkAddCoursesToDepartment(assignment.id, finalCourseData);
            }
        } catch (error) {
            console.error('Error adding course:', error);
            throw error;
        }
    },

    async addCourseForFresher(fresherId, courseData) {
        const courseRef = collection(db, 'users', fresherId, 'courses');
        const docRef = await addDoc(courseRef, {
            ...courseData,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active',
            progress: 0,
            enrolledAt: new Date()
        });
        return { success: true, courseId: docRef.id };
    },

    async bulkAddCoursesToDepartment(departmentId, courseData) {
        const freshers = await this.getFreshersByDepartment(departmentId);
        if (freshers.length === 0) {
            throw new Error('No freshers found in this department');
        }

        const batch = writeBatch(db);
        freshers.forEach(fresher => {
            const courseRef = doc(collection(db, 'users', fresher.id, 'courses'));
            batch.set(courseRef, {
                ...courseData,
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'active',
                progress: 0,
                enrolledAt: new Date(),
                assignedByDepartment: departmentId
            });
        });

        await batch.commit();
        return { success: true, assignedTo: freshers.length };
    },

    async getCoursesForFresher(fresherId) {
        const coursesRef = collection(db, 'users', fresherId, 'courses');
        const q = query(coursesRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async deleteCourse(fresherId, courseId) {
        const courseRef = doc(db, 'users', fresherId, 'courses', courseId);
        await deleteDoc(courseRef);
        return { success: true };
    },

    async getAllFreshers() {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'fresher'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async getAllDepartments() {
        const departmentsRef = collection(db, 'departments');
        const q = query(departmentsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async getFreshersByDepartment(departmentId) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'fresher'), where('departmentId', '==', departmentId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async markCourseAsCompleted(fresherId, courseId) {
        try {
            const courseRef = doc(db, 'users', fresherId, 'courses', courseId);
            const courseDoc = await getDoc(courseRef);

            if (!courseDoc.exists()) {
                throw new Error('Course not found.');
            }

            const courseData = courseDoc.data();

            await updateDoc(courseRef, {
                status: 'completed',
                updatedAt: new Date(),
                progress: 100 // Ensure progress is 100% when completed
            });

            // Add a new assessment assignment
            const assignmentsRef = collection(db, 'users', fresherId, 'assignments');
            await addDoc(assignmentsRef, {
                type: 'assessment',
                courseId: courseId,
                courseTitle: courseData.title, // Use the title of the completed course
                status: 'pending',
                assignedAt: new Date(),
                dueDate: null, // You might want to set a due date
                description: `Take the assessment for ${courseData.title}`,
            });

            return { success: true };
        } catch (error) {
            console.error('Error marking course as completed and assigning assessment:', error);
            throw error;
        }
    },

    // New function to handle fresher addition and email sending via Cloud Function
    async addFresherWithDepartmentAssignment(fresherData) {
        try {
            const password = generatePassword(); // Generate a random password

            // Helper to remove undefined values from an object
            const removeUndefined = (obj) => {
                return Object.fromEntries(
                    Object.entries(obj).filter(([, v]) => v !== undefined)
                );
            };

            const cleanedFresherData = removeUndefined(fresherData);

            const response = await fetch('https://addfresher-w7bmdisz2q-uc.a.run.app/addFresher', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ...cleanedFresherData, password }), // Pass the generated password
            });

            const result = await response.json();

            if (result.success) {
                return { success: true, email: fresherData.email, password: result.password };
            } else {
                return { success: false, error: result.error || 'Unknown error' };
            }
        } catch (error) {
            console.error('Error in addFresherWithDepartmentAssignment:', error);
            return { success: false, error: error.message };
        }
    }
};

export default courseService;
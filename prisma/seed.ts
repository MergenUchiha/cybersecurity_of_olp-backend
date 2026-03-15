import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@merdan.com' },
    update: {},
    create: {
      email: 'admin@merdan.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log(`✅ Admin created: ${admin.email}`);

  // Create teacher user
  const teacherPassword = await bcrypt.hash('Teacher123!', 12);
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@merdan.com' },
    update: {},
    create: {
      email: 'teacher@merdan.com',
      password: teacherPassword,
      firstName: 'Jane',
      lastName: 'Teacher',
      role: Role.TEACHER,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log(`✅ Teacher created: ${teacher.email}`);

  // Create student user
  const studentPassword = await bcrypt.hash('Student123!', 12);
  const student = await prisma.user.upsert({
    where: { email: 'student@merdan.com' },
    update: {},
    create: {
      email: 'student@merdan.com',
      password: studentPassword,
      firstName: 'John',
      lastName: 'Student',
      role: Role.STUDENT,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log(`✅ Student created: ${student.email}`);

  // Create sample courses
  const course1 = await prisma.course.upsert({
    where: { id: 'seed-course-1' },
    update: {},
    create: {
      id: 'seed-course-1',
      title: 'Introduction to Cybersecurity',
      description: 'Learn the fundamentals of cybersecurity including threat analysis, network security, and best practices for protecting digital assets.',
      category: 'Cybersecurity',
      isPublished: true,
      teacherId: teacher.id,
    },
  });

  const course2 = await prisma.course.upsert({
    where: { id: 'seed-course-2' },
    update: {},
    create: {
      id: 'seed-course-2',
      title: 'Web Development Fundamentals',
      description: 'Master HTML, CSS, JavaScript and modern web development frameworks. Build responsive and accessible web applications.',
      category: 'Web Development',
      isPublished: true,
      teacherId: teacher.id,
    },
  });

  const course3 = await prisma.course.upsert({
    where: { id: 'seed-course-3' },
    update: {},
    create: {
      id: 'seed-course-3',
      title: 'Database Design & SQL',
      description: 'Comprehensive course on relational database design, SQL queries, performance optimization, and data modeling best practices.',
      category: 'Database',
      isPublished: true,
      teacherId: teacher.id,
    },
  });
  console.log(`✅ Courses created: ${course1.title}, ${course2.title}, ${course3.title}`);

  // Create lessons for course 1
  const lesson1 = await prisma.lesson.upsert({
    where: { id: 'seed-lesson-1' },
    update: {},
    create: {
      id: 'seed-lesson-1',
      courseId: course1.id,
      title: 'What is Cybersecurity?',
      content: '<h2>Introduction to Cybersecurity</h2><p>Cybersecurity is the practice of protecting systems, networks, and programs from digital attacks. These cyber attacks are usually aimed at accessing, changing, or destroying sensitive information.</p><h3>Key Concepts</h3><ul><li>Confidentiality</li><li>Integrity</li><li>Availability</li></ul><p>The CIA triad forms the foundation of all cybersecurity practices.</p>',
      order: 0,
    },
  });

  const lesson2 = await prisma.lesson.upsert({
    where: { id: 'seed-lesson-2' },
    update: {},
    create: {
      id: 'seed-lesson-2',
      courseId: course1.id,
      title: 'Common Cyber Threats',
      content: '<h2>Types of Cyber Threats</h2><p>Understanding common threats is essential for building effective defenses.</p><h3>Malware</h3><p>Malicious software including viruses, worms, trojans, and ransomware.</p><h3>Phishing</h3><p>Social engineering attacks that trick users into revealing sensitive information.</p><h3>SQL Injection</h3><p>Attacks that insert malicious SQL code through application inputs.</p><h3>Cross-Site Scripting (XSS)</h3><p>Injection of malicious scripts into web pages viewed by other users.</p>',
      order: 1,
    },
  });

  const lesson3 = await prisma.lesson.upsert({
    where: { id: 'seed-lesson-3' },
    update: {},
    create: {
      id: 'seed-lesson-3',
      courseId: course1.id,
      title: 'Authentication & Authorization',
      content: '<h2>Authentication vs Authorization</h2><p><strong>Authentication</strong> verifies who you are. <strong>Authorization</strong> determines what you can do.</p><h3>Authentication Methods</h3><ul><li>Password-based</li><li>Multi-factor authentication (MFA)</li><li>Token-based (JWT)</li><li>Biometric</li></ul><h3>Best Practices</h3><ul><li>Use strong password hashing (bcrypt)</li><li>Implement rate limiting</li><li>Use secure token storage</li><li>Enable 2FA for sensitive accounts</li></ul>',
      order: 2,
    },
  });
  console.log(`✅ Lessons created for: ${course1.title}`);

  // Create a quiz for lesson 1
  const quiz = await prisma.quiz.upsert({
    where: { id: 'seed-quiz-1' },
    update: {},
    create: {
      id: 'seed-quiz-1',
      lessonId: lesson1.id,
      title: 'Cybersecurity Basics Quiz',
      description: 'Test your understanding of cybersecurity fundamentals',
      passingScore: 70,
    },
  });

  // Create questions
  const q1 = await prisma.question.upsert({
    where: { id: 'seed-q1' },
    update: {},
    create: {
      id: 'seed-q1',
      quizId: quiz.id,
      text: 'What does CIA stand for in cybersecurity?',
      order: 0,
    },
  });
  await prisma.answerOption.createMany({
    data: [
      { id: 'seed-ao-1', questionId: q1.id, text: 'Confidentiality, Integrity, Availability', isCorrect: true },
      { id: 'seed-ao-2', questionId: q1.id, text: 'Central Intelligence Agency', isCorrect: false },
      { id: 'seed-ao-3', questionId: q1.id, text: 'Computer Information Access', isCorrect: false },
      { id: 'seed-ao-4', questionId: q1.id, text: 'Cyber Investigation Authority', isCorrect: false },
    ],
    skipDuplicates: true,
  });

  const q2 = await prisma.question.upsert({
    where: { id: 'seed-q2' },
    update: {},
    create: {
      id: 'seed-q2',
      quizId: quiz.id,
      text: 'Which of the following is a type of social engineering attack?',
      order: 1,
    },
  });
  await prisma.answerOption.createMany({
    data: [
      { id: 'seed-ao-5', questionId: q2.id, text: 'SQL Injection', isCorrect: false },
      { id: 'seed-ao-6', questionId: q2.id, text: 'Phishing', isCorrect: true },
      { id: 'seed-ao-7', questionId: q2.id, text: 'Buffer Overflow', isCorrect: false },
      { id: 'seed-ao-8', questionId: q2.id, text: 'Cross-Site Scripting', isCorrect: false },
    ],
    skipDuplicates: true,
  });

  const q3 = await prisma.question.upsert({
    where: { id: 'seed-q3' },
    update: {},
    create: {
      id: 'seed-q3',
      quizId: quiz.id,
      text: 'What hashing algorithm is recommended for passwords?',
      order: 2,
    },
  });
  await prisma.answerOption.createMany({
    data: [
      { id: 'seed-ao-9', questionId: q3.id, text: 'MD5', isCorrect: false },
      { id: 'seed-ao-10', questionId: q3.id, text: 'SHA-1', isCorrect: false },
      { id: 'seed-ao-11', questionId: q3.id, text: 'bcrypt', isCorrect: true },
      { id: 'seed-ao-12', questionId: q3.id, text: 'Base64', isCorrect: false },
    ],
    skipDuplicates: true,
  });
  console.log(`✅ Quiz with ${3} questions created`);

  // Enroll student in course 1
  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId: student.id, courseId: course1.id } },
    update: {},
    create: { studentId: student.id, courseId: course1.id },
  });
  console.log(`✅ Student enrolled in: ${course1.title}`);

  console.log('\n🎉 Seeding complete!');
  console.log('──────────────────────────');
  console.log('Admin:   admin@merdan.com / Admin123!');
  console.log('Teacher: teacher@merdan.com / Teacher123!');
  console.log('Student: student@merdan.com / Student123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

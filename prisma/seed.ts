/**
 * prisma/seed.ts
 *
 * Rich seed with @faker-js/faker.
 * Run: npx prisma db seed
 * Prereq: npm install @faker-js/faker --save-dev
 */

import { PrismaClient, Role, Course, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// ─── Config ──────────────────────────────────────────────
const HASH_ROUNDS = 10;

const CATEGORIES = [
  'Cybersecurity',
  'Web Development',
  'Database',
  'Programming',
  'Networking',
  'Cloud Computing',
  'DevOps',
  'Data Science',
];

const CYBER_TOPICS = [
  'Introduction to Cybersecurity',
  'Network Security Fundamentals',
  'Penetration Testing Basics',
  'Web Application Security (OWASP Top 10)',
  'Cryptography & Encryption',
  'Social Engineering & Phishing Defense',
  'Malware Analysis',
  'Incident Response & Forensics',
  'Cloud Security Architecture',
  'Zero Trust Security Model',
  'SQL Injection & Prevention',
  'Authentication Best Practices',
];

const WEBDEV_TOPICS = [
  'HTML & CSS Fundamentals',
  'JavaScript Deep Dive',
  'React from Scratch',
  'Node.js & Express',
  'RESTful API Design',
  'Database Design Patterns',
  'TypeScript for Developers',
  'Docker & Containerization',
  'CI/CD Pipelines',
  'Performance Optimization',
];

const LESSON_CONTENTS: Record<string, string> = {
  intro: `<h2>Introduction</h2>
<p>Welcome to this lesson! In this section we'll cover the fundamental concepts you need to understand before moving forward.</p>
<h3>Learning Objectives</h3>
<ul>
  <li>Understand core principles</li>
  <li>Apply theoretical knowledge in practice</li>
  <li>Build a solid foundation for advanced topics</li>
</ul>
<h3>Why This Matters</h3>
<p>Understanding these concepts is crucial for any modern developer or security professional. The principles covered here are industry standards used by companies worldwide.</p>`,

  theory: `<h2>Theory & Concepts</h2>
<p>This lesson dives into the theoretical underpinnings of the subject matter. Pay close attention to the definitions and examples provided.</p>
<h3>Key Definitions</h3>
<p><strong>CIA Triad:</strong> Confidentiality, Integrity, and Availability — the three pillars of information security.</p>
<p><strong>Threat Vector:</strong> A path or means by which an attacker can gain access to a system.</p>
<h3>Practical Example</h3>
<pre><code>// Example: Password hashing with bcrypt
const hashedPassword = await bcrypt.hash(password, 12);
const isValid = await bcrypt.compare(input, hashedPassword);
</code></pre>`,

  practical: `<h2>Hands-On Practice</h2>
<p>In this lesson we put theory into practice. Follow the step-by-step instructions carefully.</p>
<h3>Lab Setup</h3>
<ol>
  <li>Install the required tools from the materials section</li>
  <li>Configure your environment</li>
  <li>Run the provided scripts</li>
</ol>
<h3>Expected Output</h3>
<p>After completing the lab, you should see a working implementation that demonstrates the concepts we discussed.</p>
<blockquote><strong>Note:</strong> Always practice in a controlled, legal environment. Never test security tools on systems you don't own.</blockquote>`,
};

// ─── Helpers ─────────────────────────────────────────────
async function hashPwd(plain: string) {
  return bcrypt.hash(plain, HASH_ROUNDS);
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
  console.log('🌱 Starting rich seed...\n');

  // ─── Admin ───────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@merdan.com' },
    update: {},
    create: {
      email: 'admin@merdan.com',
      password: await hashPwd('Admin123!'),
      firstName: 'Admin',
      lastName: 'Merdan',
      role: Role.ADMIN,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log(`✅ Admin:   ${admin.email}`);

  // ─── Teachers (3) ────────────────────────────────────
  const teacherData = [
    {
      email: 'teacher@merdan.com',
      firstName: 'Jane',
      lastName: 'Smith',
      password: 'Teacher123!',
    },
    {
      email: 'alex.crypto@merdan.com',
      firstName: 'Alex',
      lastName: 'Petrov',
      password: 'Teacher123!',
    },
    {
      email: 'sara.webdev@merdan.com',
      firstName: 'Sara',
      lastName: 'Yilmaz',
      password: 'Teacher123!',
    },
  ];
  const teachers = await Promise.all(
    teacherData.map((d) =>
      prisma.user.upsert({
        where: { email: d.email },
        update: {},
        create: {
          ...d,
          password: bcrypt.hashSync(d.password, HASH_ROUNDS),
          role: Role.TEACHER,
          emailVerified: true,
          isActive: true,
        },
      }),
    ),
  );
  teachers.forEach((t) => console.log(`✅ Teacher: ${t.email}`));

  // ─── Real student ────────────────────────────────────
  const mainStudent = await prisma.user.upsert({
    where: { email: 'student@merdan.com' },
    update: {},
    create: {
      email: 'student@merdan.com',
      password: await hashPwd('Student123!'),
      firstName: 'John',
      lastName: 'Student',
      role: Role.STUDENT,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log(`✅ Student: ${mainStudent.email}`);

  // ─── Fake students (20) ──────────────────────────────
  faker.seed(42); // reproducible
  const fakeStudents: User[] = [];
  for (let i = 0; i < 20; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet
      .email({ firstName, lastName, provider: 'merdan.com' })
      .toLowerCase();
    try {
      const s = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          password: await hashPwd('Student123!'),
          firstName,
          lastName,
          role: Role.STUDENT,
          emailVerified: faker.datatype.boolean({ probability: 0.85 }),
          isActive: faker.datatype.boolean({ probability: 0.92 }),
          isBlocked: faker.datatype.boolean({ probability: 0.05 }),
        },
      });
      fakeStudents.push(s);
    } catch {
      // skip duplicate email edge case
    }
  }
  console.log(`✅ Fake students: ${fakeStudents.length}`);

  // ─── Extra blocked / inactive users (for admin demo) ─
  const blockedUser = await prisma.user.upsert({
    where: { email: 'blocked.user@merdan.com' },
    update: {},
    create: {
      email: 'blocked.user@merdan.com',
      password: await hashPwd('Student123!'),
      firstName: 'Blocked',
      lastName: 'User',
      role: Role.STUDENT,
      emailVerified: true,
      isActive: true,
      isBlocked: true,
    },
  });
  console.log(`✅ Blocked user: ${blockedUser.email}\n`);

  // ─── Courses ─────────────────────────────────────────
  const courses: Course[] = [];

  // Cybersecurity courses by teacher 1
  const cyberTopics = faker.helpers.arrayElements(CYBER_TOPICS, 4);
  for (const topic of cyberTopics) {
    const c = await prisma.course.upsert({
      where: {
        id: `seed-cyber-${Buffer.from(topic).toString('hex').slice(0, 8)}`,
      },
      update: {},
      create: {
        id: `seed-cyber-${Buffer.from(topic).toString('hex').slice(0, 8)}`,
        title: topic,
        description: faker.lorem.sentences(2),
        category: 'Cybersecurity',
        isPublished: faker.datatype.boolean({ probability: 0.8 }),
        teacherId: teachers[0].id,
      },
    });
    courses.push(c);
  }

  // Web dev courses by teacher 2
  const webTopics = faker.helpers.arrayElements(WEBDEV_TOPICS, 3);
  for (const topic of webTopics) {
    const c = await prisma.course.upsert({
      where: {
        id: `seed-web-${Buffer.from(topic).toString('hex').slice(0, 8)}`,
      },
      update: {},
      create: {
        id: `seed-web-${Buffer.from(topic).toString('hex').slice(0, 8)}`,
        title: topic,
        description: faker.lorem.sentences(2),
        category: 'Web Development',
        isPublished: faker.datatype.boolean({ probability: 0.75 }),
        teacherId: teachers[1].id,
      },
    });
    courses.push(c);
  }

  // Mixed courses by teacher 3
  for (let i = 0; i < 2; i++) {
    const cat = randomItem(['Database', 'Programming', 'DevOps', 'Networking']);
    const id = `seed-misc-${i}-${teachers[2].id.slice(0, 6)}`;
    const c = await prisma.course.upsert({
      where: { id },
      update: {},
      create: {
        id,
        title: `${cat} ${faker.company.buzzVerb()} ${i + 1}`,
        description: faker.lorem.sentences(3),
        category: cat,
        isPublished: true,
        teacherId: teachers[2].id,
      },
    });
    courses.push(c);
  }

  // Make sure the main cybersec intro course exists (used in old seeds)
  const introCourse = await prisma.course.upsert({
    where: { id: 'seed-course-1' },
    update: {},
    create: {
      id: 'seed-course-1',
      title: 'Introduction to Cybersecurity',
      description:
        'Learn the fundamentals of cybersecurity including threat analysis, network security, and best practices.',
      category: 'Cybersecurity',
      isPublished: true,
      teacherId: teachers[0].id,
    },
  });
  if (!courses.find((c) => c.id === 'seed-course-1')) courses.push(introCourse);

  console.log(`✅ Courses created: ${courses.length}`);

  // ─── Lessons for each course ──────────────────────────
  const lessonTitlePrefixes = [
    'Introduction to',
    'Deep Dive into',
    'Practical',
    'Advanced',
    'Workshop:',
  ];
  const lessonSubjects = [
    'Core Concepts',
    'Real-World Applications',
    'Tools & Techniques',
    'Security Analysis',
    'Best Practices',
    'Case Studies',
  ];

  for (const course of courses) {
    const lessonCount = randomInt(3, 6);
    const lessonIds: string[] = [];
    for (let li = 0; li < lessonCount; li++) {
      const lessonId = `lesson-${course.id.slice(-6)}-${li}`;
      const contentType =
        li === 0 ? 'intro' : li % 2 === 0 ? 'practical' : 'theory';
      try {
        const lesson = await prisma.lesson.upsert({
          where: { id: lessonId },
          update: {},
          create: {
            id: lessonId,
            courseId: course.id,
            title: `${randomItem(lessonTitlePrefixes)} ${randomItem(lessonSubjects)}`,
            content: LESSON_CONTENTS[contentType],
            videoUrl: faker.datatype.boolean({ probability: 0.4 })
              ? `https://www.youtube.com/watch?v=${faker.string.alphanumeric(11)}`
              : undefined,
            order: li,
          },
        });
        lessonIds.push(lesson.id);

        // ─── Quiz for each lesson (60% chance) ──────────
        if (faker.datatype.boolean({ probability: 0.6 })) {
          const quizId = `quiz-${lessonId}`;
          const quiz = await prisma.quiz.upsert({
            where: { id: quizId },
            update: {},
            create: {
              id: quizId,
              lessonId: lesson.id,
              title: `${lesson.title} — Quiz`,
              description: 'Test your understanding of this lesson.',
              passingScore: randomItem([60, 70, 75, 80]),
              timeLimit: faker.datatype.boolean({ probability: 0.5 })
                ? randomItem([10, 15, 20, 30])
                : undefined,
            },
          });

          // 3–5 questions per quiz
          const qCount = randomInt(3, 5);
          for (let qi = 0; qi < qCount; qi++) {
            const qId = `q-${quizId}-${qi}`;
            const question = await prisma.question.upsert({
              where: { id: qId },
              update: {},
              create: {
                id: qId,
                quizId: quiz.id,
                text: generateQuestion(course.category || 'General', qi),
                order: qi,
              },
            });

            // 4 answer options, 1 correct
            const correctIdx = randomInt(0, 3);
            const options = generateOptions(
              course.category || 'General',
              qi,
              correctIdx,
            );
            await prisma.answerOption.createMany({
              data: options.map((opt, oi) => ({
                id: `opt-${qId}-${oi}`,
                questionId: question.id,
                text: opt,
                isCorrect: oi === correctIdx,
              })),
              skipDuplicates: true,
            });
          }
        }
      } catch {
        // skip conflicts
      }
    }
  }
  console.log('✅ Lessons & Quizzes created');

  // ─── Enrollments ─────────────────────────────────────
  // Main student → intro course + 2 others
  const publishedCourses = courses.filter((c) => c.isPublished);
  const enrollTargets = [
    introCourse,
    ...faker.helpers.arrayElements(
      publishedCourses.filter((c) => c.id !== 'seed-course-1'),
      2,
    ),
  ];
  for (const course of enrollTargets) {
    await prisma.enrollment.upsert({
      where: {
        studentId_courseId: { studentId: mainStudent.id, courseId: course.id },
      },
      update: {},
      create: { studentId: mainStudent.id, courseId: course.id },
    });
  }

  // Fake students → random 1-4 courses each
  for (const student of fakeStudents) {
    const n = randomInt(1, 4);
    const picks = faker.helpers.arrayElements(
      publishedCourses,
      Math.min(n, publishedCourses.length),
    );
    for (const c of picks) {
      await prisma.enrollment
        .upsert({
          where: {
            studentId_courseId: { studentId: student.id, courseId: c.id },
          },
          update: {},
          create: { studentId: student.id, courseId: c.id },
        })
        .catch(() => {});
    }
  }
  console.log('✅ Enrollments created');

  // ─── Security Events (for analytics charts) ──────────
  const secEventTypes = [
    { type: 'LOGIN_SUCCESS', weight: 40 },
    { type: 'LOGIN_FAILURE', weight: 20 },
    { type: 'LOGOUT', weight: 15 },
    { type: 'REFRESH_TOKEN', weight: 10 },
    { type: 'BRUTE_FORCE_DETECTED', weight: 3 },
    { type: 'RATE_LIMIT_TRIGGERED', weight: 4 },
    { type: 'SUSPICIOUS_REQUEST', weight: 3 },
    { type: 'ACCESS_DENIED', weight: 3 },
    { type: 'ACCOUNT_BLOCKED', weight: 1 },
    { type: 'PASSWORD_CHANGE', weight: 1 },
  ] as const;

  const allUsers = [admin, ...teachers, mainStudent, ...fakeStudents];
  const weightedTypes = secEventTypes.flatMap(({ type, weight }) =>
    Array(weight).fill(type),
  );

  const now = Date.now();
  const MS_PER_DAY = 86_400_000;
  let eventsCreated = 0;

  for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
    // More events on recent days (realistic)
    const eventsPerDay =
      daysAgo < 7
        ? randomInt(8, 25)
        : daysAgo < 14
          ? randomInt(3, 12)
          : randomInt(1, 6);

    for (let e = 0; e < eventsPerDay; e++) {
      const offsetMs = randomInt(0, MS_PER_DAY - 1);
      const occurredAt = new Date(now - daysAgo * MS_PER_DAY + offsetMs);
      const eventType = randomItem(weightedTypes) as any;
      const user = faker.datatype.boolean({ probability: 0.8 })
        ? randomItem(allUsers)
        : null;

      try {
        await prisma.securityEvent.create({
          data: {
            eventType,
            userId: user?.id ?? null,
            ipAddress: faker.internet.ipv4(),
            userAgent: faker.internet.userAgent(),
            details:
              eventType === 'LOGIN_FAILURE'
                ? {
                    reason: randomItem([
                      'Invalid password',
                      'Account not found',
                      'Account blocked',
                    ]),
                    email: user?.email ?? null,
                  }
                : eventType === 'BRUTE_FORCE_DETECTED'
                  ? {
                      reason: 'Too many failed attempts',
                      count: randomInt(5, 20),
                    }
                  : undefined,
            occurredAt,
          },
        });
        eventsCreated++;
      } catch {
        // skip
      }
    }
  }
  console.log(`✅ Security events: ${eventsCreated}`);

  // ─── Audit Logs ───────────────────────────────────────
  const auditActions = [
    'CREATE',
    'UPDATE',
    'DELETE',
    'PUBLISH',
    'ENROLL',
    'LOGIN',
    'LOGOUT',
  ] as const;
  const auditEntities = ['Course', 'Lesson', 'User', 'Quiz', 'Enrollment'];
  let auditCreated = 0;

  for (let i = 0; i < 80; i++) {
    const user = randomItem(allUsers);
    const action = randomItem(auditActions as any);
    const entity = randomItem(auditEntities);
    try {
      await prisma.auditLog.create({
        data: {
          action: action as any,
          userId: user.id,
          targetEntity: entity,
          targetId: faker.string.uuid(),
          details: { note: faker.lorem.sentence() },
          ipAddress: faker.internet.ipv4(),
          createdAt: faker.date.recent({ days: 30 }),
        },
      });
      auditCreated++;
    } catch {}
  }
  console.log(`✅ Audit logs: ${auditCreated}`);

  // ─── Sessions (for sessions admin page) ──────────────
  for (const user of [mainStudent, ...fakeStudents.slice(0, 10), ...teachers]) {
    const sessionCount = randomInt(1, 3);
    for (let si = 0; si < sessionCount; si++) {
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken: await bcrypt.hash(faker.string.uuid(), 6),
          ipAddress: faker.internet.ipv4(),
          userAgent: faker.internet.userAgent(),
          expiresAt: faker.date.soon({ days: 7 }),
          isRevoked: false,
          createdAt: faker.date.recent({ days: 2 }),
        },
      });
    }
  }
  console.log('✅ Sessions created');

  // ─── Summary ─────────────────────────────────────────
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.lesson.count(),
    prisma.quiz.count(),
    prisma.enrollment.count(),
    prisma.securityEvent.count(),
    prisma.auditLog.count(),
  ]);

  console.log('\n═══════════════════════════════════════════');
  console.log('🎉 Seed complete!');
  console.log('───────────────────────────────────────────');
  console.log(`Users:           ${counts[0]}`);
  console.log(`Courses:         ${counts[1]}`);
  console.log(`Lessons:         ${counts[2]}`);
  console.log(`Quizzes:         ${counts[3]}`);
  console.log(`Enrollments:     ${counts[4]}`);
  console.log(`Security Events: ${counts[5]}`);
  console.log(`Audit Logs:      ${counts[6]}`);
  console.log('───────────────────────────────────────────');
  console.log('Credentials:');
  console.log('  admin@merdan.com   / Admin123!');
  console.log('  teacher@merdan.com / Teacher123!');
  console.log('  student@merdan.com / Student123!');
  console.log('═══════════════════════════════════════════\n');
}

// ─── Question / Answer generators ────────────────────────
function generateQuestion(category: string, idx: number): string {
  const cyberQuestions = [
    'What does the CIA triad stand for in cybersecurity?',
    'Which of the following is NOT a type of social engineering attack?',
    'What is the recommended algorithm for password hashing?',
    'What HTTP header helps prevent XSS attacks?',
    'What does SQL injection exploit?',
    'Which port does HTTPS use by default?',
    'What is a Zero-Day vulnerability?',
    'What is the purpose of a DMZ in network security?',
    'Which protocol is used for secure remote login?',
    'What is a Man-in-the-Middle (MitM) attack?',
  ];
  const webQuestions = [
    'What does REST stand for in API design?',
    'Which HTTP method is idempotent?',
    'What is the purpose of CORS?',
    'Which status code means "Not Found"?',
    'What does JWT stand for?',
    'What is the difference between authentication and authorization?',
    'Which HTML tag is used for semantic navigation?',
    'What is the virtual DOM in React?',
    'What does async/await do in JavaScript?',
    'What is a closure in JavaScript?',
  ];
  const genericQuestions = [
    `What is the primary purpose of ${category}?`,
    `Which of the following best describes ${category}?`,
    `What is a common best practice in ${category}?`,
    `Which tool is most commonly used in ${category}?`,
    `What does the term "scalability" mean in ${category}?`,
  ];

  const pool =
    category === 'Cybersecurity'
      ? cyberQuestions
      : category === 'Web Development'
        ? webQuestions
        : genericQuestions;
  return pool[idx % pool.length];
}

function generateOptions(
  category: string,
  qIdx: number,
  correctIdx: number,
): string[] {
  const cyberAnswers = [
    [
      'Confidentiality, Integrity, Availability',
      'Central Intelligence Agency',
      'Certified Internet Authority',
      'Computer Incident Analysis',
    ],
    ['Phishing', 'Brute Force', 'SQL Injection', 'Vishing'],
    ['bcrypt', 'MD5', 'SHA-1', 'Base64'],
    [
      'Content-Security-Policy',
      'X-Frame-Options',
      'Authorization',
      'X-Custom-Header',
    ],
    [
      'Unsanitized user input in SQL queries',
      'Weak passwords',
      'Missing firewall rules',
      'Unpatched OS',
    ],
    ['443', '80', '8080', '21'],
    [
      'A flaw unknown to the vendor',
      'A planned system update',
      'A backup process',
      'An encryption protocol',
    ],
    [
      'Isolate internal network segments',
      'Speed up DNS resolution',
      'Block all traffic',
      'Enable logging only',
    ],
    ['SSH', 'FTP', 'HTTP', 'SMTP'],
    [
      'Intercepting communications between two parties',
      'Cracking passwords offline',
      'Injecting malicious scripts',
      'Flooding a server with traffic',
    ],
  ];
  const webAnswers = [
    [
      'Representational State Transfer',
      'Remote Execution Service Transfer',
      'Reliable Endpoint State Token',
      'Resource Enabled State Transfer',
    ],
    ['GET', 'POST', 'PATCH', 'CONNECT'],
    [
      'Allow cross-origin requests safely',
      'Compress HTTP responses',
      'Cache static assets',
      'Encrypt API payloads',
    ],
    ['404', '200', '301', '500'],
    [
      'JSON Web Token',
      'Java Web Transfer',
      'JavaScript Worker Thread',
      'Join Web Transaction',
    ],
    [
      'AuthN verifies identity, AuthZ controls permissions',
      'They are the same thing',
      'AuthN is server-side, AuthZ is client-side',
      'AuthZ is done before AuthN',
    ],
    ['<nav>', '<div>', '<section>', '<header>'],
    [
      'An in-memory representation of the real DOM',
      'A browser API',
      'A CSS framework',
      'A database driver',
    ],
    [
      'Pauses execution until a Promise resolves',
      'Runs code in parallel threads',
      'Compiles TypeScript to JS',
      'Polyfills older APIs',
    ],
    [
      'A function that retains access to outer scope variables',
      'A CSS pseudo-class',
      'A React hook',
      'A generator function',
    ],
  ];
  const genericAnswers = [
    [
      'To ensure system reliability and security',
      'To increase marketing ROI',
      'To reduce hardware costs',
      'To simplify UI design',
    ],
    [
      'A systematic approach to solving domain problems',
      'A random collection of scripts',
      'A proprietary hardware tool',
      'A CSS naming convention',
    ],
    [
      'Consistent documentation and testing',
      'Skipping code reviews',
      'Avoiding version control',
      'Using one global variable',
    ],
    [
      'Open-source, community-supported toolchain',
      'Proprietary closed-source only',
      'Hardware-dependent solutions',
      'Manual command-line scripts',
    ],
    [
      'Ability to handle growing workloads gracefully',
      'Making code shorter',
      'Removing all comments',
      'Using only SQL databases',
    ],
  ];

  const pool =
    category === 'Cybersecurity'
      ? cyberAnswers
      : category === 'Web Development'
        ? webAnswers
        : genericAnswers;
  const answers = pool[qIdx % pool.length];

  // Rotate so correctIdx lands at the right position
  const correct = answers[0]; // first item is always correct in our pools
  const others = answers.slice(1);
  const result = [...others];
  result.splice(correctIdx, 0, correct);
  return result.slice(0, 4);
}

// ─── Run ─────────────────────────────────────────────────
main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

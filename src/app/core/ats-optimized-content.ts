import type { JobEntry, SkillRow } from './resume.types';

/** Single source of truth for Auto-fix for ATS and default resume content. */
export const ATS_OPTIMIZED_SUMMARY =
  'Full Stack Software Engineer with more than two years of experience building enterprise-grade applications across banking, finance, and Enterprise Resource Planning domains. Specialized in .NET Core, ASP.NET, Angular, React.js, AWS serverless services, and Microsoft Dynamics 365. Proven record of designing scalable REST APIs, optimizing SQL performance, integrating cloud services, and shipping production features that reduce operational load and accelerate release cycles. Strong collaborator focused on clean code, testable architecture, Agile execution, and measurable business impact across the full software development lifecycle.';

export const ATS_OPTIMIZED_SKILL_ROWS: SkillRow[] = [
  {
    label: 'Languages:',
    value: 'C Sharp, TypeScript, JavaScript, Python, SQL, C++, Microsoft Dynamics X++',
  },
  {
    label: 'Backend & APIs:',
    value:
      '.NET and C#, .NET Core Web API, ASP.NET, FastAPI, REST APIs, SOAP APIs, Microservices Architecture, MVC',
  },
  { label: 'Frontend:', value: 'Angular, React.js, Next.js, HTML5, CSS3, Lightning Components' },
  { label: 'Databases:', value: 'SQL Server, MySQL, MongoDB, DynamoDB' },
  {
    label: 'Cloud & DevOps:',
    value: 'AWS Lambda, AWS Cognito, AWS S3, AWS SNS, AWS SES, IIS Deployment, CI/CD Pipelines, Git',
  },
  {
    label: 'Microsoft Dynamics:',
    value: 'Dynamics 365 Finance and Operations, Dynamics 365 Commerce, Dynamics 365 CRM, Power Automate',
  },
  {
    label: 'Tools & Libraries:',
    value: 'Hangfire, Application Object Tree, Visual Studio, Postman, Swagger',
  },
  {
    label: 'Practices:',
    value: 'Agile, Scrum, Code Reviews, Unit Testing, Database Optimization, System Integration',
  },
];

export const ATS_OPTIMIZED_CERTIFICATIONS: string[] = [
  'Full Stack Development – BariTechSol (2024)',
  '.NET Developer – BariTechSol (2024)',
  'Salesforce for Developers Part I and Part II – 10 Pearls (2023)',
  'HackerRank C Sharp Object-Oriented Programming Certification',
  'Microsoft Dynamics 365 Finance and Operations Technical Training Bootcamp (2024)',
];

/** Canonical bullets per employer — matches Auto-fix output. */
export function rewriteJobForAts(
  company: string,
  role: string,
): { role: string; bullets: string[] } | null {
  const c = company.toLowerCase();
  if (c.includes('cee solutions')) {
    return {
      role: 'Software Engineer',
      bullets: [
        'Designed and shipped 3 enterprise platforms for cash collection, workflow operations, and budget management using ASP.NET, .NET Core, and Angular, supporting daily use by 40+ internal users.',
        'Engineered a serverless ASP.NET Core (.NET 8) backend on AWS Lambda for a real-time messaging platform, integrating Cognito, DynamoDB, SNS, SES, and S3 to power low-latency communication at scale.',
        'Designed scalable services for question and session lifecycle management, real-time chat, push notifications, and media uploads, powering 3 admin dashboards on a layered cloud architecture.',
        'Automated 12 recurring scheduled tasks with Hangfire background jobs, improving production stability during peak activity windows and removing manual operator intervention.',
        'Optimized resource-intensive SQL queries and reporting paths, cutting average report wait times from minutes to near real time across 20+ core dashboards.',
      ],
    };
  }
  if (c.includes('baritechsol')) {
    return {
      role: 'Associate Full Stack Software Developer',
      bullets: [
        'Mastered the end-to-end architecture of a shipment-service microservices suite spanning 4 core services, accelerating feature rollout with fewer dependency handoffs.',
        'Drove implementation, debugging, and testing across 8+ sprint milestones, helping the team release planned scope on schedule throughout the engagement.',
        'Partnered with senior engineers on issue triage, resolving 15+ production-facing defects within the same sprint and improving release predictability across recent cycles.',
      ],
    };
  }
  if (c.includes('evincible sol')) {
    return {
      role: 'Microsoft Dynamics 365 Finance and Operations Technical Consultant Intern',
      bullets: [
        'Customized Microsoft Dynamics 365 Finance and Operations tables, forms, event handlers, and Chain of Command extensions across 10+ objects to support client-specific business workflows.',
        'Implemented workflow automation and Application Object Tree enhancements across 3 process areas, reducing manual approval follow-ups and improving operational consistency.',
      ],
    };
  }
  if (c.includes('folio3')) {
    return {
      role: role || 'Software Engineering Intern',
      bullets: [
        'Supported implementation, debugging, and QA tasks across full project cycles, helping milestone releases stay on track for 2 active project streams.',
        'Collaborated with cross-functional teams to validate feature behavior and close test feedback before release sign-off across 6 sprint demo cycles.',
      ],
    };
  }
  return null;
}

/** Default job entries — ids preserved for workspace compatibility. */
export function defaultJobsWithAtsContent(): JobEntry[] {
  const rw = (company: string, role: string, dates: string, id: string) => {
    const r = rewriteJobForAts(company, role)!;
    return { id, company, dates, role: r.role, bullets: r.bullets };
  };
  return [
    rw('Cee Solutions', 'Software Engineer', 'Jan 2025 – Present', 'j1'),
    rw('BariTechSol', 'Associate Full Stack Software Developer', 'May 2024 – Dec 2024', 'j2'),
    rw(
      'Evincible Sol',
      'Microsoft Dynamics 365 Finance and Operations Technical Consultant Intern',
      'Dec 2023 – Feb 2024',
      'j3',
    ),
    rw('Folio3 Soft', 'Software Engineering Intern', 'May 2022 – Aug 2022', 'j4'),
  ];
}

// In-browser mock data and fallback engine for GitHub Pages static hosting
export const MOCK_USERS = [
  {
    id: 1,
    email: "student@university.edu",
    full_name: "Alex Rivera",
    role: "candidate",
    recruiter_status: "approved",
    headline: "Computer Science Senior @ State University",
    location: "Seattle, WA",
    skills: "Python, React, FastAPI, PostgreSQL, Docker, Git, JavaScript",
    bio: "Passionate software engineer excited about backend platforms and distributed systems.",
    is_active: true,
    is_email_verified: true,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    email: "recruiter@techcorp.com",
    full_name: "Elena Rostova",
    role: "recruiter",
    recruiter_status: "approved",
    company: "CloudScale Systems",
    location: "San Francisco, CA",
    headline: "Lead Technical Recruiter at CloudScale Systems",
    bio: "Hiring top distributed systems and backend engineers.",
    is_active: true,
    is_email_verified: true,
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    email: "pending@startup.io",
    full_name: "Marcus Vance",
    role: "recruiter",
    recruiter_status: "pending",
    company: "NextGen AI",
    location: "Austin, TX",
    headline: "Founder & Talent Lead at NextGen AI",
    bio: "Early stage stealth startup scaling founding engineering team.",
    is_active: true,
    is_email_verified: true,
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    email: "admin@recruit.com",
    full_name: "Platform Administrator",
    role: "admin",
    recruiter_status: "approved",
    headline: "System Administrator & Compliance Officer",
    bio: "Managing talent network integrity and verification.",
    is_active: true,
    is_email_verified: true,
    created_at: new Date().toISOString()
  }
];

export const MOCK_JOBS = [
  {
    id: 1,
    recruiter_id: 2,
    title: "Backend Cloud Engineer",
    company: "CloudScale Systems",
    location: "Remote (US / Canada)",
    job_type: "Full-time",
    experience_level: "Entry to Mid-Level",
    salary_range: "$95,000 - $130,000",
    description: "We are building hyper-scale microservices and seeking an engineer who loves clean APIs, relational databases, and automated testing.",
    application_deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
    is_active: true,
    is_flagged_spam: false,
    created_at: new Date().toISOString(),
    skills: [
      { skill_name: "Python", is_required: true },
      { skill_name: "FastAPI", is_required: true },
      { skill_name: "PostgreSQL", is_required: true },
      { skill_name: "Docker", is_required: true },
      { skill_name: "Redis", is_required: false },
      { skill_name: "AWS", is_required: false },
      { skill_name: "Kubernetes", is_required: false }
    ],
    recruiter: MOCK_USERS[1]
  },
  {
    id: 2,
    recruiter_id: 2,
    title: "Frontend React Developer",
    company: "CloudScale Systems",
    location: "San Francisco, CA / Hybrid",
    job_type: "Full-time",
    experience_level: "Junior / Mid",
    salary_range: "$90,000 - $120,000",
    description: "Join our web experience team craft intuitive dashboards, reactive visualizations, and reusable component libraries.",
    application_deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    is_active: true,
    is_flagged_spam: false,
    created_at: new Date().toISOString(),
    skills: [
      { skill_name: "React", is_required: true },
      { skill_name: "JavaScript", is_required: true },
      { skill_name: "TypeScript", is_required: true },
      { skill_name: "CSS", is_required: true },
      { skill_name: "Tailwind", is_required: false },
      { skill_name: "GraphQL", is_required: false }
    ],
    recruiter: MOCK_USERS[1]
  }
];

export const MOCK_SLOTS = [
  {
    id: 101,
    job_id: 1,
    recruiter_id: 2,
    start_time: new Date(Date.now() + 2 * 86400000).toISOString(),
    end_time: new Date(Date.now() + 2 * 86400000 + 45 * 60000).toISOString(),
    selection_deadline: new Date(Date.now() + 1.5 * 86400000).toISOString(),
    meeting_link: "https://meet.google.com/cs4-interview-slot-a",
    notes: "Technical screen: System architecture & API design discussion (45 min)",
    is_booked: false,
    is_cancelled: false
  },
  {
    id: 102,
    job_id: 1,
    recruiter_id: 2,
    start_time: new Date(Date.now() + 3 * 86400000).toISOString(),
    end_time: new Date(Date.now() + 3 * 86400000 + 45 * 60000).toISOString(),
    selection_deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
    meeting_link: "https://meet.google.com/cs4-interview-slot-b",
    notes: "Live coding walkthrough (45 min)",
    is_booked: false,
    is_cancelled: false
  }
];

export const MOCK_POSTS = [
  {
    id: 1,
    author_id: 2,
    author: MOCK_USERS[1],
    content: "Excited to announce CloudScale Systems is actively looking for junior backend talent! Tip: Tailor your resume skills directly to the requirements for instant ATS scoring.",
    is_hidden: false,
    likes_count: 5,
    is_liked_by_me: true,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    comments: [
      {
        id: 1,
        author: MOCK_USERS[0],
        content: "Great tip! Looking forward to applying."
      }
    ]
  }
];

export const MOCK_APPLICATIONS = [
  {
    id: 1,
    job_id: 1,
    candidate_id: 1,
    original_filename: "Alex_Rivera_Resume.pdf",
    resume_file_path: "Alex_Rivera_Resume.pdf",
    ats_score: 85.0,
    matched_skills_json: JSON.stringify(["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"]),
    missing_skills_json: JSON.stringify(["Redis", "Kubernetes"]),
    status: "Interview",
    is_hold_overlay: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    job: MOCK_JOBS[0],
    candidate: MOCK_USERS[0],
    booked_slot: MOCK_SLOTS[0]
  }
];

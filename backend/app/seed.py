from datetime import datetime, timedelta
from app.database import SessionLocal, Base, engine
from app.models import (
    User, UserRole, RecruiterStatus, Job, JobSkill, InterviewSlot,
    Post, PostLike, PostComment, Connection
)
from app.auth import get_password_hash

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(User).first():
        print("Database already contains data. Skipping seed.")
        db.close()
        return

    print("Seeding initial demonstration data...")

    # 1. Create Users
    admin = User(
        email="admin@recruit.com",
        hashed_password=get_password_hash("admin123"),
        full_name="Platform Administrator",
        role=UserRole.ADMIN,
        recruiter_status=RecruiterStatus.APPROVED,
        headline="System Administrator & Compliance Officer",
        bio="Managing talent network integrity and verification.",
        is_active=True,
        is_email_verified=True
    )

    recruiter1 = User(
        email="recruiter@techcorp.com",
        hashed_password=get_password_hash("recruiter123"),
        full_name="Elena Rostova",
        role=UserRole.RECRUITER,
        recruiter_status=RecruiterStatus.APPROVED,
        headline="Lead Technical Recruiter at CloudScale Systems",
        company="CloudScale Systems",
        location="San Francisco, CA",
        bio="Hiring top distributed systems and backend engineers.",
        is_active=True,
        is_email_verified=True
    )

    recruiter2 = User(
        email="pending@startup.io",
        hashed_password=get_password_hash("pending123"),
        full_name="Marcus Vance",
        role=UserRole.RECRUITER,
        recruiter_status=RecruiterStatus.PENDING,  # Ready for Admin approval demo!
        headline="Founder & Talent Lead at NextGen AI",
        company="NextGen AI",
        location="Austin, TX",
        bio="Early stage stealth startup scaling founding engineering team.",
        is_active=True,
        is_email_verified=True
    )

    candidate1 = User(
        email="student@university.edu",
        hashed_password=get_password_hash("student123"),
        full_name="Alex Rivera",
        role=UserRole.CANDIDATE,
        recruiter_status=RecruiterStatus.APPROVED,
        headline="Computer Science Senior @ State University",
        location="Seattle, WA",
        skills="Python, React, FastAPI, PostgreSQL, Docker, Git, JavaScript",
        bio="Passionate software engineer excited about backend platforms and distributed systems.",
        is_active=True,
        is_email_verified=True
    )

    candidate2 = User(
        email="maya@college.edu",
        hashed_password=get_password_hash("maya123"),
        full_name="Maya Chen",
        role=UserRole.CANDIDATE,
        recruiter_status=RecruiterStatus.APPROVED,
        headline="Software Engineering Major & Open Source Contributor",
        location="Boston, MA",
        skills="React, TypeScript, CSS, Node, GraphQL, Figma",
        bio="Front-end and full-stack enthusiast with an eye for UI performance.",
        is_active=True,
        is_email_verified=True
    )

    db.add_all([admin, recruiter1, recruiter2, candidate1, candidate2])
    db.commit()

    # 2. Create Jobs with Required and Preferred skills (FR-REC-01, FR-REC-02)
    job1 = Job(
        recruiter_id=recruiter1.id,
        title="Backend Cloud Engineer",
        company="CloudScale Systems",
        location="Remote (US / Canada)",
        job_type="Full-time",
        experience_level="Entry to Mid-Level",
        salary_range="$95,000 - $130,000",
        description="We are building hyper-scale microservices and seeking an engineer who loves clean APIs, relational databases, and automated testing.",
        application_deadline=datetime.utcnow() + timedelta(days=14),
        is_active=True
    )
    db.add(job1)
    db.flush()

    skills_job1 = [
        JobSkill(job_id=job1.id, skill_name="Python", is_required=True),
        JobSkill(job_id=job1.id, skill_name="FastAPI", is_required=True),
        JobSkill(job_id=job1.id, skill_name="PostgreSQL", is_required=True),
        JobSkill(job_id=job1.id, skill_name="Docker", is_required=True),
        JobSkill(job_id=job1.id, skill_name="Redis", is_required=False),
        JobSkill(job_id=job1.id, skill_name="AWS", is_required=False),
        JobSkill(job_id=job1.id, skill_name="Kubernetes", is_required=False),
    ]
    db.add_all(skills_job1)

    job2 = Job(
        recruiter_id=recruiter1.id,
        title="Frontend React Developer",
        company="CloudScale Systems",
        location="San Francisco, CA / Hybrid",
        job_type="Full-time",
        experience_level="Junior / Mid",
        salary_range="$90,000 - $120,000",
        description="Join our web experience team craft intuitive dashboards, reactive visualizations, and reusable component libraries.",
        application_deadline=datetime.utcnow() + timedelta(days=30),
        is_active=True
    )
    db.add(job2)
    db.flush()

    skills_job2 = [
        JobSkill(job_id=job2.id, skill_name="React", is_required=True),
        JobSkill(job_id=job2.id, skill_name="JavaScript", is_required=True),
        JobSkill(job_id=job2.id, skill_name="TypeScript", is_required=True),
        JobSkill(job_id=job2.id, skill_name="CSS", is_required=True),
        JobSkill(job_id=job2.id, skill_name="Tailwind", is_required=False),
        JobSkill(job_id=job2.id, skill_name="GraphQL", is_required=False),
    ]
    db.add_all(skills_job2)

    # Suspicious Job (for Admin Spam Monitor demo)
    job_spam = Job(
        recruiter_id=recruiter1.id,
        title="Earn Fast $5000 Daily Telegram Data Entry",
        company="Global Wealth Group",
        location="Anywhere",
        job_type="Part-time",
        experience_level="No Experience",
        salary_range="$5000 / week",
        description="Guaranteed rich income! Just message us on telegram for free money.",
        is_active=False,
        is_flagged_spam=True,
        spam_reason="Suspicious telegram / clickbait keywords detected."
    )
    db.add(job_spam)
    db.flush()
    db.add(JobSkill(job_id=job_spam.id, skill_name="Typing", is_required=True))

    # 3. Create Interview Slots (FR-REC-04)
    now = datetime.utcnow()
    slot1 = InterviewSlot(
        job_id=job1.id,
        recruiter_id=recruiter1.id,
        start_time=now + timedelta(days=2, hours=10),
        end_time=now + timedelta(days=2, hours=10, minutes=45),
        selection_deadline=now + timedelta(days=1, hours=20),
        meeting_link="https://meet.google.com/cs4-interview-slot-a",
        notes="Technical screen: System architecture & API design discussion (45 min)",
        is_booked=False
    )
    slot2 = InterviewSlot(
        job_id=job1.id,
        recruiter_id=recruiter1.id,
        start_time=now + timedelta(days=2, hours=14),
        end_time=now + timedelta(days=2, hours=14, minutes=45),
        selection_deadline=now + timedelta(days=1, hours=20),
        meeting_link="https://meet.google.com/cs4-interview-slot-b",
        notes="Technical screen: System architecture & live coding walkthrough (45 min)",
        is_booked=False
    )
    slot3 = InterviewSlot(
        job_id=job1.id,
        recruiter_id=recruiter1.id,
        start_time=now + timedelta(days=3, hours=11),
        end_time=now + timedelta(days=3, hours=11, minutes=45),
        selection_deadline=now + timedelta(days=2, hours=18),
        meeting_link="https://meet.google.com/cs4-interview-slot-c",
        notes="Technical screen: Morning slot (45 min)",
        is_booked=False
    )
    db.add_all([slot1, slot2, slot3])

    # 4. Networking & Feed posts (FR-NET-01, FR-NET-04)
    conn = Connection(
        requester_id=candidate1.id,
        receiver_id=recruiter1.id,
        status="ACCEPTED"
    )
    db.add(conn)

    post1 = Post(
        author_id=recruiter1.id,
        content="Excited to announce CloudScale Systems is actively looking for new grad & junior backend talent! Tip: Tailor your resume skills directly to the requirements for instant ATS scoring."
    )
    post2 = Post(
        author_id=candidate1.id,
        content="Just wrapped up my senior capstone project building high-concurrency microservices with FastAPI and Docker. Looking forward to upcoming recruiter chats!"
    )
    db.add_all([post1, post2])
    db.commit()

    db.add(PostLike(post_id=post1.id, user_id=candidate1.id))
    db.add(PostComment(
        post_id=post1.id,
        author_id=candidate1.id,
        content="Great tip! Checking out the job openings now."
    ))
    db.commit()

    print("Seed complete! Demo credentials:")
    print("  Admin:     admin@recruit.com / admin123")
    print("  Recruiter: recruiter@techcorp.com / recruiter123")
    print("  Pending:   pending@startup.io / pending123")
    print("  Student:   student@university.edu / student123")
    db.close()

if __name__ == "__main__":
    seed_database()

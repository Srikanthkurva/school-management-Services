-- School Management SaaS Database Schema (PostgreSQL)
-- Run this in NeonDB console or via psql

-- 1. Users table (Central Auth)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    admission_no VARCHAR(50) UNIQUE,
    employee_id VARCHAR(50) UNIQUE,
    dob DATE,
    avatar VARCHAR(255),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    subject VARCHAR(50),
    qualification TEXT,
    experience VARCHAR(50),
    salary DECIMAL(10, 2),
    join_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Students Table
CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    roll_no VARCHAR(20) UNIQUE,
    class_name VARCHAR(20),
    section VARCHAR(10),
    parent_name VARCHAR(100),
    parent_phone VARCHAR(20),
    dob DATE,
    gender VARCHAR(10),
    address TEXT,
    admission_date DATE,
    total_fees DECIMAL(10, 2),
    paid_fees DECIMAL(10, 2),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50),
    class_name VARCHAR(20),
    date DATE NOT NULL,
    status VARCHAR(20),
    subject VARCHAR(50),
    teacher_id VARCHAR(50),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- 5. Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(50),
    class_name VARCHAR(20),
    teacher_id VARCHAR(50),
    due_date DATE,
    max_marks INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- 6. Results Table
CREATE TABLE IF NOT EXISTS results (
    id VARCHAR(50) PRIMARY KEY,
    student_id VARCHAR(50),
    exam_name VARCHAR(100),
    total_marks INTEGER,
    marks_obtained INTEGER,
    percentage DECIMAL(5, 2),
    grade VARCHAR(5),
    result_status VARCHAR(10),
    FOREIGN KEY (student_id) REFERENCES users(id)
);

-- 7. Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    user_name VARCHAR(100),
    action TEXT,
    type VARCHAR(20),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255),
    message TEXT,
    type VARCHAR(20),
    target_role VARCHAR(20),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Enquiries Table
CREATE TABLE IF NOT EXISTS enquiries (
    id VARCHAR(50) PRIMARY KEY,
    academic_year VARCHAR(20),
    board VARCHAR(50),
    state VARCHAR(50),
    city VARCHAR(50),
    school VARCHAR(100),
    grade VARCHAR(20),
    child_name VARCHAR(100),
    gender VARCHAR(20),
    parent_name VARCHAR(100),
    mobile VARCHAR(20),
    email VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Online Admissions Table
CREATE TABLE IF NOT EXISTS admissions (
    id VARCHAR(50) PRIMARY KEY,
    admission_no VARCHAR(50) UNIQUE,
    academic_year VARCHAR(20),
    board VARCHAR(50),
    state VARCHAR(50),
    city VARCHAR(50),
    school VARCHAR(100),
    class_name VARCHAR(20),
    orientation VARCHAR(50),
    section VARCHAR(20),
    student_type VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    dob DATE,
    gender VARCHAR(20),
    father_name VARCHAR(100),
    mother_name VARCHAR(100),
    parent_mobile VARCHAR(20),
    parent_email VARCHAR(100),
    aadhaar_no VARCHAR(20),
    address TEXT,
    quota VARCHAR(50),
    admission_type VARCHAR(50),
    father_occupation VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    student_id VARCHAR(50),
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
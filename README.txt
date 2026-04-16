8-9-25

ADDED:
- database connection
- database
- student table
- form animations

How to use:
1. Install XAMPP
2. Copy the project folder to the htdocs folder in C:\xampp\htdocs
3. Open XAMPP. Start Apache and MySQL. Open MySQL Admin
4. In MyPHPAdmin page, go to SQL table and enter the following syntaxes:


CREATE DATABASE IF NOT EXISTS shs_club_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE shs_club_db;


CREATE TABLE IF NOT EXISTS students (
  student_id VARCHAR(20) PRIMARY KEY,  -- now the primary key
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NOT NULL,
  sti_email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  profile_picture VARCHAR(255) NULL, -- file path to image we will upload later
  club VARCHAR(100) NULL,            -- placeholder; later switch to club_id INT referencing clubs table
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sti_email (sti_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

5. Tangina mo Teamy.

NOTE: In testing, do not use LiveServer to test. Use http://localhost/capstone/index.html

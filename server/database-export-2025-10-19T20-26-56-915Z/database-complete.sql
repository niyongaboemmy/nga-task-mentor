
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `due_date` datetime NOT NULL,
  `max_score` int NOT NULL,
  `submission_type` enum('file','text','both') NOT NULL DEFAULT 'both',
  `allowed_file_types` json DEFAULT NULL,
  `rubric` json DEFAULT NULL,
  `course_id` int NOT NULL,
  `created_by` int DEFAULT NULL,
  `status` enum('draft','published','completed','removed') NOT NULL DEFAULT 'draft',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `course_id` (`course_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `assignments_ibfk_241` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `assignments_ibfk_242` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `assignments` WRITE;
/*!40000 ALTER TABLE `assignments` DISABLE KEYS */;
INSERT INTO `assignments` (`id`, `title`, `description`, `due_date`, `max_score`, `submission_type`, `allowed_file_types`, `rubric`, `course_id`, `created_by`, `status`, `created_at`, `updated_at`) VALUES (1,'Test Assignment','This is a test assignment for testing the system','2025-12-31 23:59:59',100,'both',NULL,NULL,1,1,'published','2025-10-18 00:44:26','2025-10-18 00:44:26'),(2,'Develop a Personal Portfolio Website','<p><span style=\"font-size: inherit; font-weight: inherit; color: rgb(0, 0, 0);\">📝 </span><strong style=\"font-size: inherit; color: rgb(0, 0, 0);\">Assignment Instructions:</strong></p>\n<p><font color=\"#000000\">You are required to design and develop a <strong>Personal Portfolio Website</strong> that introduces you as a developer/designer. The site should showcase your skills, projects, and contact details.</font></p>\n<hr>\n<h3><font color=\"#000000\">🧱 <strong>Requirements:</strong></font></h3>\n<h4><strong><font color=\"#000000\">1. Structure (HTML):</font></strong></h4>\n<ul>\n<li>\n<p><font color=\"#000000\">Create at least <strong>three pages</strong>:</font></p>\n<ol>\n<li>\n<p><font color=\"#000000\"><strong>Home</strong> – A short introduction and photo/banner.</font></p>\n</li>\n<li>\n<p><font color=\"#000000\"><strong>About Me</strong> – Education, skills, and interests.</font></p>\n</li>\n<li>\n<p><font color=\"#000000\"><strong>Projects</strong> – Display 2–3 sample projects with descriptions.</font></p>\n</li>\n<li>\n<p><font color=\"#000000\"><em>(Optional)</em> Contact page or section with a form.</font></p>\n</li><li><p><font color=\"#000000\"><br></font></p></li>\n</ol>\n</li>\n</ul>\n<h4><strong><font color=\"#000000\">2. Styling (CSS):</font></strong></h4>\n<ul>\n<li>\n<p><font color=\"#000000\">Use <strong>an external CSS file</strong> for styling.</font></p>\n</li>\n<li>\n<p><font color=\"#000000\">Apply the following concepts:</font></p>\n<ul>\n<li>\n<p><font color=\"#000000\">Color scheme and typography consistency.</font></p>\n</li>\n<li>\n<p><font color=\"#000000\">CSS layout (Flexbox or Grid).</font></p>\n</li>\n<li>\n<p><font color=\"#000000\">Hover effects for buttons or links.</font></p>\n</li>\n<li>\n<p><font color=\"#000000\">Responsive design (website should adapt to mobile and desktop screens).</font></p>\n</li><li><p><font color=\"#000000\"><br></font></p></li>\n</ul>\n</li>\n</ul>\n<h4><strong><font color=\"#000000\">3. Interactivity (optional for bonus marks):</font></strong></h4>\n<ul>\n<li>\n<p><font color=\"#000000\">Add a <strong>simple JavaScript feature</strong>, e.g.:</font></p>\n<ul>\n<li>\n<p><font color=\"#000000\">“Back to top” button.</font></p>\n</li>\n<li>\n<p><font color=\"#000000\">Form validation.</font></p>\n</li>\n<li>\n<p><font color=\"#000000\">Theme switcher (light/dark mode).</font></p>\n</li>\n</ul>\n</li>\n</ul>\n<hr>\n<h3><font color=\"#000000\">💡 <strong>Suggested Tools:</strong></font></h3>\n<ul>\n<li>\n<p><font color=\"#000000\"><strong>Code editor:</strong> VS Code or any preferred IDE.</font></p>\n</li>\n<li>\n<p><font color=\"#000000\"><strong>Browser:</strong> Chrome, Firefox, or Edge.</font></p>\n</li>\n<li>\n<p><font color=\"#000000\"><strong>Frameworks (optional):</strong> Tailwind CSS / Bootstrap (for students familiar with them).</font></p>\n</li>\n</ul>\n<hr>\n<h3><font color=\"#000000\">📦 <strong>Submission Guidelines:</strong></font></h3>\n<ul>\n<li>\n<p><font color=\"#000000\">Submit all files in a folder named:<br>\n<code inline=\"\">YourName_Portfolio_UI</code></font></p>\n</li>\n<li>\n<p><font color=\"#000000\">Include:</font></p>\n<ul>\n<li>\n<p><code inline=\"\"><font color=\"#000000\">index.html</font></code></p>\n</li>\n<li>\n<p><font color=\"#000000\"><code inline=\"\">about.html</code>, <code inline=\"\">projects.html</code></font></p>\n</li>\n<li>\n<p><code inline=\"\"><font color=\"#000000\">style.css</font></code></p>\n</li>\n<li>\n<p><font color=\"#000000\">Any image or script files used.</font></p>\n</li>\n</ul>\n</li>\n<li>\n<p><font color=\"#000000\">Compress the folder into <code inline=\"\">.zip</code> and upload via the platform.</font></p>\n</li>\n</ul>\n<hr>\n<h3><font color=\"#000000\">🧮 <strong>Assessment Criteria:</strong></font></h3>\n<table>\n<thead>\n<tr>\n<th style=\"text-align: left;\"><font color=\"#000000\">Criteria</font></th>\n<th style=\"text-align: left;\"><font color=\"#000000\">Description</font></th>\n<th><font color=\"#000000\">Marks</font></th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td><font color=\"#000000\">HTML structure</font></td>\n<td><font color=\"#000000\">Semantic tags, well-formed code</font></td>\n<td><font color=\"#000000\">20</font></td>\n</tr>\n<tr>\n<td><font color=\"#000000\">CSS styling &amp; layout</font></td>\n<td><font color=\"#000000\">Visual design, use of colors, fonts, spacing&nbsp; &nbsp; &nbsp;&nbsp;</font></td>\n<td><font color=\"#000000\">30</font></td>\n</tr>\n<tr>\n<td><font color=\"#000000\">Responsiveness</font></td>\n<td><font color=\"#000000\">Works well on mobile and desktop</font></td>\n<td><font color=\"#000000\">20</font></td>\n</tr>\n<tr>\n<td><font color=\"#000000\">Creativity</font></td>\n<td><font color=\"#000000\">Aesthetic appeal, originality</font></td>\n<td><font color=\"#000000\">20</font></td>\n</tr>\n<tr>\n<td><font color=\"#000000\">(Optional) JavaScript interactivity</font></td>\n<td><font color=\"#000000\">Bonus feature(s)</font></td>\n<td><font color=\"#000000\">+10</font></td>\n</tr>\n</tbody>\n</table>\n<p><font color=\"#000000\"><strong>Total:</strong> 90 marks (+10 bonus)</font></p>','2025-10-19 18:00:00',100,'both',NULL,NULL,2,2,'completed','2025-10-18 15:07:24','2025-10-19 19:07:27');
/*!40000 ALTER TABLE `assignments` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `courses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `title` varchar(100) NOT NULL,
  `description` text NOT NULL,
  `credits` int NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `max_students` int NOT NULL,
  `instructor_id` int NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `courses_code_unique` (`code`),
  KEY `instructor_id` (`instructor_id`),
  CONSTRAINT `courses_ibfk_1` FOREIGN KEY (`instructor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `courses` WRITE;
/*!40000 ALTER TABLE `courses` DISABLE KEYS */;
INSERT INTO `courses` (`id`, `code`, `title`, `description`, `credits`, `start_date`, `end_date`, `is_active`, `max_students`, `instructor_id`, `created_at`, `updated_at`) VALUES (1,'TEST101','Test Course','A test course for testing',3,'2025-01-01','2025-05-01',1,50,1,'2025-10-18 00:43:54','2025-10-18 00:43:54'),(2,'SPEWI302','Development of web user interface','Development of a web user interface refers to the process of designing and building the part of a website or web application that users interact with directly through their web browser',3,'2025-09-29','2025-11-09',1,30,2,'2025-10-18 11:04:52','2025-10-18 11:04:52');
/*!40000 ALTER TABLE `courses` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `assignment_id` int DEFAULT NULL,
  `student_id` int DEFAULT NULL,
  `status` enum('draft','submitted','late','graded','resubmitted') NOT NULL DEFAULT 'draft',
  `submitted_at` datetime DEFAULT NULL,
  `text_submission` text,
  `file_submissions` json DEFAULT NULL,
  `grade` json DEFAULT NULL,
  `feedback` text,
  `resubmissions` json DEFAULT NULL,
  `is_late` tinyint(1) NOT NULL DEFAULT '0',
  `comments` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_assignment_student` (`assignment_id`,`student_id`),
  KEY `submissions_student_id` (`student_id`),
  KEY `submissions_assignment_id` (`assignment_id`),
  KEY `submissions_status` (`status`),
  KEY `submissions_submitted_at` (`submitted_at`),
  CONSTRAINT `submissions_ibfk_241` FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `submissions_ibfk_242` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `submissions` WRITE;
/*!40000 ALTER TABLE `submissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `submissions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user_courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_courses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `course_id` int NOT NULL,
  `enrollment_date` datetime NOT NULL,
  `completion_date` datetime DEFAULT NULL,
  `status` enum('enrolled','completed','dropped') NOT NULL DEFAULT 'enrolled',
  `grade` varchar(2) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_courses_course_id_user_id_unique` (`user_id`,`course_id`),
  UNIQUE KEY `unique_user_course` (`user_id`,`course_id`),
  KEY `course_id` (`course_id`),
  CONSTRAINT `user_courses_ibfk_241` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_courses_ibfk_242` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `user_courses` WRITE;
/*!40000 ALTER TABLE `user_courses` DISABLE KEYS */;
INSERT INTO `user_courses` (`id`, `user_id`, `course_id`, `enrollment_date`, `completion_date`, `status`, `grade`, `created_at`, `updated_at`) VALUES (1,3,2,'2025-10-18 15:56:27',NULL,'enrolled',NULL,'2025-10-18 15:56:27','2025-10-18 15:56:27');
/*!40000 ALTER TABLE `user_courses` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('student','instructor','admin') NOT NULL DEFAULT 'student',
  `profile_image` varchar(255) DEFAULT NULL,
  `reset_password_token` varchar(255) DEFAULT NULL,
  `reset_password_expire` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `email_2` (`email`),
  UNIQUE KEY `email_3` (`email`),
  UNIQUE KEY `email_4` (`email`),
  UNIQUE KEY `email_5` (`email`),
  UNIQUE KEY `email_6` (`email`),
  UNIQUE KEY `email_7` (`email`),
  UNIQUE KEY `email_8` (`email`),
  UNIQUE KEY `email_9` (`email`),
  UNIQUE KEY `email_10` (`email`),
  UNIQUE KEY `email_11` (`email`),
  UNIQUE KEY `email_12` (`email`),
  UNIQUE KEY `email_13` (`email`),
  UNIQUE KEY `email_14` (`email`),
  UNIQUE KEY `email_15` (`email`),
  UNIQUE KEY `email_16` (`email`),
  UNIQUE KEY `email_17` (`email`),
  UNIQUE KEY `email_18` (`email`),
  UNIQUE KEY `email_19` (`email`),
  UNIQUE KEY `email_20` (`email`),
  UNIQUE KEY `email_21` (`email`),
  UNIQUE KEY `email_22` (`email`),
  UNIQUE KEY `email_23` (`email`),
  UNIQUE KEY `email_24` (`email`),
  UNIQUE KEY `email_25` (`email`),
  UNIQUE KEY `email_26` (`email`),
  UNIQUE KEY `email_27` (`email`),
  UNIQUE KEY `email_28` (`email`),
  UNIQUE KEY `email_29` (`email`),
  UNIQUE KEY `email_30` (`email`),
  UNIQUE KEY `email_31` (`email`),
  UNIQUE KEY `email_32` (`email`),
  UNIQUE KEY `email_33` (`email`),
  UNIQUE KEY `email_34` (`email`),
  UNIQUE KEY `email_35` (`email`),
  UNIQUE KEY `email_36` (`email`),
  UNIQUE KEY `email_37` (`email`),
  UNIQUE KEY `email_38` (`email`),
  UNIQUE KEY `email_39` (`email`),
  UNIQUE KEY `email_40` (`email`),
  UNIQUE KEY `email_41` (`email`),
  UNIQUE KEY `email_42` (`email`),
  UNIQUE KEY `email_43` (`email`),
  UNIQUE KEY `email_44` (`email`),
  UNIQUE KEY `email_45` (`email`),
  UNIQUE KEY `email_46` (`email`),
  UNIQUE KEY `email_47` (`email`),
  UNIQUE KEY `email_48` (`email`),
  UNIQUE KEY `email_49` (`email`),
  UNIQUE KEY `email_50` (`email`),
  UNIQUE KEY `email_51` (`email`),
  UNIQUE KEY `email_52` (`email`),
  UNIQUE KEY `email_53` (`email`),
  UNIQUE KEY `email_54` (`email`),
  UNIQUE KEY `email_55` (`email`),
  UNIQUE KEY `email_56` (`email`),
  UNIQUE KEY `email_57` (`email`),
  UNIQUE KEY `email_58` (`email`),
  UNIQUE KEY `email_59` (`email`),
  UNIQUE KEY `email_60` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `password`, `role`, `profile_image`, `reset_password_token`, `reset_password_expire`, `created_at`, `updated_at`) VALUES (1,'Test','Instructor','test@example.com','password123','instructor',NULL,NULL,NULL,'2025-10-18 00:40:40','2025-10-18 00:40:40'),(2,'NIYONGABO','Emmanuel','emmanuelniyongabo44@gmail.com','$2a$10$nZYW3C3HzB9QbWb6xib0UOZm61S6BGy2BoVpJiwFvvehuS7Twm./u','instructor',NULL,NULL,NULL,'2025-10-18 10:51:59','2025-10-18 10:51:59'),(3,'Doe','John','johndoe@gmail.com','$2a$10$WoHMdBSsJnnJuDAwWkvQreX8B.oSMsyYb6fVQojQDrQnSF8EKsYcu','student',NULL,NULL,NULL,'2025-10-18 15:36:13','2025-10-18 15:36:13'),(4,'Test','Student','test@student.com','$2a$10$lHAw/UnLTAC93Ii8QOWC1.Rz0LOw9KaV2DOBDB4.2wRD0FHxQsLdi','student',NULL,NULL,NULL,'2025-10-19 16:01:35','2025-10-19 16:01:35');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


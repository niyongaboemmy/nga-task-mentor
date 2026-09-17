
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
DROP TABLE IF EXISTS `SequelizeMeta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SequelizeMeta` (
  `name` varchar(255) COLLATE utf8mb3_unicode_ci NOT NULL,
  PRIMARY KEY (`name`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `SequelizeMeta` WRITE;
/*!40000 ALTER TABLE `SequelizeMeta` DISABLE KEYS */;
INSERT INTO `SequelizeMeta` VALUES ('20250125000000-update-quiz-status-and-add-public.js'),('20250125000001-add-question-seconds.js'),('20250125000002-add-end-time-to-quiz-submissions.js'),('20250126000000-create-proctoring-tables.js'),('20251107233653-fix-proctoring-session-data-types.js'),('20251109233653-add-connection-tracking-to-proctoring-sessions.js'),('20251114203917-add-created-by-to-questions.js'),('20251123000000-add-proctoring-rules-and-events.js'),('20251125191600-add-submitted-correct-answers-to-quiz-attempts.js'),('20251125192000-harmonize-correct-answers.js'),('20260114000000-add-mis-user-id.js'),('20260114224114-drop-courses-and-user-courses-tables.js'),('20260118000000-add-quiz-attachments.js'),('20260301145000-add-scheme-of-work-fields-to-question-bank.js'),('20260507000000-update-quiz-type-enum.js'),('20260531000000-add-submitted-by-to-submissions.js'),('20260607000000-create-report-card-tables.js'),('20260607120000-add-uuid-pdf-to-report-cards.js'),('20260608000000-add-grade-columns-to-manual-assessments.js'),('20260812120000-create-database-query-logs.js'),('20260812174501-create-roles-permissions-tables.js'),('20260812174502-seed-default-roles-and-permissions.js'),('20260812174503-add-role-id-to-users.js'),('20260812174504-backfill-user-role-id.js'),('20260812180000-add-manage-any-permissions.js'),('20260913200710-create-subject-assessment-mappings.js');
/*!40000 ALTER TABLE `SequelizeMeta` ENABLE KEYS */;
UNLOCK TABLES;
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
  `allowed_file_types` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `rubric` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `course_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `status` enum('draft','published','completed','removed') NOT NULL DEFAULT 'draft',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `course_id` (`course_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `assignments_ibfk_118` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `assignments` WRITE;
/*!40000 ALTER TABLE `assignments` DISABLE KEYS */;
INSERT INTO `assignments` VALUES (1,'Create a personal portfolio website','<h3><font size=\"5\" color=\"#000000\"><b>Activity</b></font></h3><p data-start=\"112\" data-end=\"262\"><font color=\"#000000\">Create a&nbsp;<span data-start=\"121\" data-end=\"151\">personal portfolio website</span>&nbsp;that showcases your skills, projects, and contact information using&nbsp;<span data-start=\"220\" data-end=\"259\">HTML, CSS, and basic web interfaces</span>.</font></p><p data-start=\"112\" data-end=\"262\"><font color=\"#000000\"><br></font></p><p data-start=\"264\" data-end=\"380\"><font color=\"#000000\">After completing your design,&nbsp;<span data-start=\"294\" data-end=\"339\"><u>compress (zip)</u> your entire project folder</span>&nbsp;and submit it&nbsp;<span data-start=\"354\" data-end=\"377\">before the deadline.</span></font></p><p><font color=\"#000000\"><br></font></p><h3><font size=\"5\" color=\"#000000\"><b>Task Description</b></font></h3><p><font color=\"#000000\">You are required to&nbsp;<strong>design and develop</strong>&nbsp;a personal portfolio webpage that includes the following interfaces and design elements:</font></p><p><font color=\"#000000\"><br></font></p><h4><font color=\"#000000\">1.&nbsp;<strong>Homepage (Introduction Section)</strong></font></h4><ul><li><p><font color=\"#000000\">Include your name, photo, and a short bio or personal statement.</font></p></li><li><p><font color=\"#000000\">Add navigation links to other sections (About, Projects, Contact).</font></p></li><li><p><font color=\"#000000\"><br></font></p></li></ul><h4><font color=\"#000000\">2.&nbsp;<strong>About Me page</strong></font></h4><ul><li><p><font color=\"#000000\">Write a brief description about yourself (education, goals, skills).</font></p></li><li><p><font color=\"#000000\">Use&nbsp;<strong>CSS styling</strong>&nbsp;to organize content clearly and attractively.</font></p></li></ul><h4><font color=\"#000000\"><br></font></h4><h4><font color=\"#000000\">3.&nbsp;<strong>Projects page</strong></font></h4><ul><li><p><font color=\"#000000\">Display at least&nbsp;<strong>three projects</strong>&nbsp;you have done (real or sample).</font></p></li><li><p><font color=\"#000000\">Use a&nbsp;<strong>table</strong>&nbsp;to organize project names, descriptions, and technologies used.</font></p></li><li><p><font color=\"#000000\"><br></font></p></li></ul><h4><font color=\"#000000\">4.&nbsp;<strong>Contact page</strong></font></h4><ul><li><p><font color=\"#000000\">Create a&nbsp;<strong>contact form page</strong>&nbsp;with the following fields:</font></p><ul><li><p><font color=\"#000000\">Full Name</font></p></li><li><p><font color=\"#000000\">Email Address</font></p></li><li><p><font color=\"#000000\">Message</font></p></li><li><p><font color=\"#000000\">Submit Button</font></p></li></ul></li><li></li><li><p><font color=\"#000000\"><br></font></p></li></ul><h4><font color=\"#000000\">5.&nbsp;<strong>Page Footer</strong></font></h4><ul><li><p><font color=\"#000000\">Add copyright information and social media links.</font></p></li><li><p><font color=\"#000000\"><br></font></p></li></ul><h3><font size=\"5\" color=\"#000000\"><b>Interfaces to Implement</b></font></h3><p><font color=\"#000000\">Make sure to include these&nbsp;<strong>HTML interfaces</strong>&nbsp;in your design:</font></p><table><thead><tr><th><font color=\"#000000\">Interface</font></th><th><font color=\"#000000\">Description</font></th><th><font color=\"#000000\">Example</font></th></tr></thead><tbody><tr><td><code inline=\"\"><font color=\"#000000\">&lt;div&gt;</font></code></td><td><font color=\"#000000\">Generic container for grouping elements&nbsp;</font></td><td><code inline=\"\"><font color=\"#000000\">&lt;div class=\"container\"&gt;&lt;/div&gt;</font></code></td></tr><tr><td><code inline=\"\"><font color=\"#000000\">&lt;section&gt;&nbsp;</font></code></td><td><font color=\"#000000\">Defines thematic grouping of content</font></td><td><code inline=\"\"><font color=\"#000000\">&lt;section id=\"about\"&gt;&lt;/section&gt;</font></code></td></tr><tr><td><code inline=\"\"><font color=\"#000000\">&lt;article&gt;</font></code></td><td><font color=\"#000000\">Independent content unit</font></td><td><code inline=\"\"><font color=\"#000000\">&lt;article&gt;&lt;h3&gt;My Project&lt;/h3&gt;&lt;/article&gt;</font></code></td></tr><tr><td><code inline=\"\"><font color=\"#000000\">&lt;table&gt;</font></code></td><td><font color=\"#000000\">Displays tabular data</font></td><td><code inline=\"\"><font color=\"#000000\">&lt;table&gt;&lt;tr&gt;&lt;td&gt;Project 1&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;</font></code></td></tr><tr><td><code inline=\"\"><font color=\"#000000\">&lt;form&gt;</font></code></td><td><font color=\"#000000\">Collects user input</font></td><td><code inline=\"\"><font color=\"#000000\">&lt;form&gt;&lt;input type=\"text\" name=\"name\"&gt;&lt;/form&gt;</font></code></td></tr></tbody></table><h3><font color=\"#000000\"><br></font></h3><h3><b><font color=\"#000000\">Design Requirements</font></b></h3><ul><li><p><font color=\"#000000\">Apply&nbsp;<strong>CSS styling</strong>&nbsp;(colors, margins, fonts, hover effects).</font></p></li><li><p><font color=\"#000000\">Use a&nbsp;<strong>consistent color theme and layout</strong>&nbsp;across all sections.</font></p></li><li><p><font color=\"#000000\">Ensure your site is&nbsp;<strong>responsive</strong>&nbsp;on both desktop and mobile devices.</font></p></li><li><p><font color=\"#000000\">Include&nbsp;<strong>comments</strong>&nbsp;in your code to describe main parts.</font></p></li></ul><h3><font color=\"#000000\"><br></font></h3><div><h3><font size=\"5\" color=\"#000000\"><b>Output Examples</b></font></h3></div><p><font color=\"#000000\">Your portfolio page should include:</font></p><ul><li><p><font color=\"#000000\">Navigation bar</font></p></li><li><p><font color=\"#000000\">Profile image</font></p></li><li><p><font color=\"#000000\">Sections (About, Projects, Contact)</font></p></li><li><p><font color=\"#000000\">Styled table for project listing</font></p></li><li><p><font color=\"#000000\">Functional contact form</font></p></li></ul><div><b id=\"docs-internal-guid-379a72b6-7fff-5b63-a8f1-fca4d9d6ac75\"><font color=\"#000000\"><br></font></b></div>','2025-10-22 22:33:00',100,'both',NULL,NULL,1,1,'completed','2025-10-20 13:12:22','2025-10-24 14:35:42'),(2,'Implement Web Components (Table & Form)','<h3 data-start=\"1540\" data-end=\"1552\"><p data-start=\"397\" data-end=\"657\"><font color=\"#000000\"><strong data-start=\"397\" data-end=\"411\">Objective:</strong><br data-start=\"411\" data-end=\"414\">\nDesign and implement <strong data-start=\"435\" data-end=\"457\">two web components</strong> — a table and a form — that follow the given descriptions. Apply proper layout, colors, spacing, and alignment to make the components visually appealing and consistent with a styled webpage.</font></p>\n</h3><h3 data-start=\"664\" data-end=\"684\"><strong data-start=\"668\" data-end=\"684\"><font color=\"#000000\"><br></font></strong></h3><h3 data-start=\"664\" data-end=\"684\"><strong data-start=\"668\" data-end=\"684\"><font color=\"#000000\">Instructions</font></strong></h3><h3 data-start=\"1540\" data-end=\"1552\"><ol data-start=\"686\" data-end=\"1019\" style=\"list-style-type: lower-alpha; margin-left: 25px;\">\n<li data-start=\"782\" data-end=\"829\"><font color=\"#000000\"><span style=\"font-size: inherit; font-weight: inherit;\">Create a new&nbsp;</span><span data-start=\"702\" data-end=\"726\" style=\"font-size: inherit; font-weight: inherit;\">HTML and CSS project</span><span style=\"font-size: inherit; font-weight: inherit;\">.</span></font></li><li data-start=\"782\" data-end=\"829\"><font color=\"#000000\">Implement both components described below.</font></li><li data-start=\"782\" data-end=\"829\"><font color=\"#000000\">Use <span data-start=\"837\" data-end=\"862\" style=\"font-size: inherit; font-weight: inherit;\">CSS layout techniques</span><span style=\"font-size: inherit; font-weight: inherit;\"> such as </span><strong data-start=\"871\" data-end=\"882\" style=\"font-size: inherit;\">Flexbox</strong><span style=\"font-size: inherit; font-weight: inherit;\"> or </span><strong data-start=\"886\" data-end=\"894\" style=\"font-size: inherit;\">Grid</strong><span style=\"font-size: inherit; font-weight: inherit;\"> for alignment and spacing.</span></font></li><li data-start=\"782\" data-end=\"829\"><font color=\"#000000\">Ensure your design is <strong data-start=\"949\" data-end=\"984\" style=\"font-size: inherit;\">clean, readable, and consistent</strong><span style=\"font-size: inherit; font-weight: inherit;\"> in style (fonts, colors, margins).</span></font></li></ol><div><font color=\"#000000\"><br></font></div></h3><h3 data-start=\"1540\" data-end=\"1552\"><font color=\"#000000\"><b>Tip</b></font></h3>\n<p data-start=\"1553\" data-end=\"1576\"><font color=\"#000000\">Pay close attention to:</font></p>\n<ol style=\"list-style-type: lower-alpha; margin-left: 25px;\"><li><font color=\"#000000\">Alignment and spacing</font></li><li><font color=\"#000000\">Font styles and colors</font></li></ol><div><font color=\"#000000\"><br></font></div><div><h3 data-start=\"1026\" data-end=\"1067\"><strong data-start=\"1030\" data-end=\"1067\"><font color=\"#000000\">Component 1: Student Grades Table</font></strong></h3>\n<p data-start=\"1069\" data-end=\"1132\"><font color=\"#000000\">Create a table to display students and their grades as follows:</font></p></div><div><font color=\"#000000\"><b><br></b></font></div><div><span id=\"docs-internal-guid-8b4437bf-7fff-88ac-0fae-f3c80b20e54c\"><span id=\"docs-internal-guid-58e64771-7fff-ce41-1bb6-7cfd169a2414\" style=\"font-weight: bold;\"><span id=\"docs-internal-guid-0895260f-7fff-645a-a597-09d11924b1a3\" style=\"font-weight: bold;\"><span id=\"docs-internal-guid-ed9e2c27-7fff-2f54-408b-96ab8c0e7188\" style=\"font-weight: bold;\"><font color=\"#000000\" style=\"\"><div dir=\"ltr\" align=\"left\" style=\"\"><table><colgroup><col width=\"213\"><col width=\"203\"></colgroup><tbody><tr><td><p dir=\"ltr\"><span style=\"font-weight: normal;\">Grade</span></p></td><td><p dir=\"ltr\"><span style=\"font-weight: normal;\">Students</span></p></td></tr><tr><td rowspan=\"2\"><p dir=\"ltr\"><span style=\"font-weight: normal;\">G1</span></p></td><td><p dir=\"ltr\"><span style=\"font-weight: normal;\">TUNGA</span></p></td></tr><tr><td><p dir=\"ltr\"><span style=\"font-weight: normal;\">ISHIMWE</span></p></td></tr><tr><td rowspan=\"2\"><p dir=\"ltr\"><span style=\"font-weight: normal;\">G2</span></p></td><td><p dir=\"ltr\"><span style=\"font-weight: normal;\">Kenny</span></p></td></tr><tr><td><p dir=\"ltr\"><span style=\"font-weight: normal;\">Brian</span></p></td></tr><tr><td colspan=\"2\"><p dir=\"ltr\"><span style=\"font-weight: normal;\">Note: G1 - Grade 1, G2: Grade 2</span></p></td></tr></tbody></table></div><br></font></span></span></span></span></div><div><b><font color=\"#000000\"><br></font></b></div><div><h3 data-start=\"1417\" data-end=\"1463\"><strong data-start=\"1421\" data-end=\"1463\"><font color=\"#000000\">Component 2: Student Registration Form</font></strong></h3>\n<p data-start=\"1465\" data-end=\"1522\"><font color=\"#000000\">Design a form that allows entering basic student details.</font></p>\n<p data-start=\"1524\" data-end=\"1546\"><strong data-start=\"1524\" data-end=\"1546\"><font color=\"#000000\">Fields to include:</font></strong></p><p data-start=\"1524\" data-end=\"1546\"><strong data-start=\"1524\" data-end=\"1546\"><font color=\"#000000\"><br></font></strong></p></div><p><ol style=\"list-style-type: lower-alpha; margin-left: 25px;\"><li><font color=\"#000000\">First Name</font></li><li><font color=\"#000000\">Last Name</font></li><li><font color=\"#000000\">Gender: choose one from (Male, Female)</font></li><li><font color=\"#000000\">Social Media: choose more than one from (Facebook, Instagram, LinkedIn, X.com)<br></font></li></ol></p>\n<p data-start=\"1672\" data-end=\"1805\" data-is-last-node=\"\" data-is-only-node=\"\"></p>','2025-10-22 08:50:00',100,'both',NULL,NULL,1,1,'completed','2025-10-20 13:52:10','2025-10-24 14:35:44'),(3,'This is the testing assignment','This is the testing assignment<font color=\"#000000\">&nbsp;1111</font><div><font color=\"#000000\">This is the testing assignment This is the testing assignment This is the testing assignment&nbsp;</font></div><div><font color=\"#000000\">This is the testing assignment This is the testing assignment This is the testing assignment This is the testing assignment This is the testing assignment This is the testing assignment This is the testing assignment</font></div>','2025-10-21 02:30:00',100,'both',NULL,NULL,1,1,'removed','2025-10-20 16:16:09','2025-10-20 17:16:14');
/*!40000 ALTER TABLE `assignments` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `blooms_taxonomy_levels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blooms_taxonomy_levels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `level_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `blooms_taxonomy_levels` WRITE;
/*!40000 ALTER TABLE `blooms_taxonomy_levels` DISABLE KEYS */;
/*!40000 ALTER TABLE `blooms_taxonomy_levels` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `database_query_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `database_query_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `query_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `statement_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_write` tinyint(1) NOT NULL DEFAULT '0',
  `row_count` int DEFAULT NULL,
  `execution_ms` int DEFAULT NULL,
  `status` enum('success','error') COLLATE utf8mb4_unicode_ci NOT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `database_query_logs_user_id` (`user_id`),
  KEY `database_query_logs_created_at` (`created_at`),
  CONSTRAINT `database_query_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `database_query_logs` WRITE;
/*!40000 ALTER TABLE `database_query_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `database_query_logs` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `manual_assessment_scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manual_assessment_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `manual_assessment_id` int NOT NULL,
  `student_id` int NOT NULL,
  `score` float NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `manual_assessment_scores_manual_assessment_id_student_id` (`manual_assessment_id`,`student_id`),
  CONSTRAINT `manual_assessment_scores_ibfk_1` FOREIGN KEY (`manual_assessment_id`) REFERENCES `manual_assessments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `manual_assessment_scores` WRITE;
/*!40000 ALTER TABLE `manual_assessment_scores` DISABLE KEYS */;
/*!40000 ALTER TABLE `manual_assessment_scores` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `manual_assessments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manual_assessments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `course_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assessment_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assessment_number` int DEFAULT NULL,
  `assessment_date` date DEFAULT NULL,
  `add_to_final_grade` tinyint(1) NOT NULL DEFAULT '1',
  `max_score` float NOT NULL,
  `term` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `academic_year` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `manual_assessments` WRITE;
/*!40000 ALTER TABLE `manual_assessments` DISABLE KEYS */;
/*!40000 ALTER TABLE `manual_assessments` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`),
  KEY `permissions_category` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=69 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'USERS_VIEW_SELF','USERS','View own user profile','2026-09-17 19:00:24','2026-09-17 19:00:24'),(2,'USERS_VIEW_ALL','USERS','View any user\'s profile','2026-09-17 19:00:24','2026-09-17 19:00:24'),(3,'USERS_CREATE','USERS','Create user accounts','2026-09-17 19:00:24','2026-09-17 19:00:24'),(4,'USERS_EDIT','USERS','Edit any user account','2026-09-17 19:00:24','2026-09-17 19:00:24'),(5,'USERS_DELETE','USERS','Delete user accounts','2026-09-17 19:00:24','2026-09-17 19:00:24'),(6,'USERS_MANAGE_ENROLLMENT','USERS','Enroll/withdraw users from courses','2026-09-17 19:00:24','2026-09-17 19:00:24'),(7,'USERS_VIEW_OTHERS_ACTIVITY','USERS','View another user\'s assignments/quizzes/courses','2026-09-17 19:00:24','2026-09-17 19:00:24'),(8,'COURSES_VIEW','COURSES','View course list/details','2026-09-17 19:00:24','2026-09-17 19:00:24'),(9,'COURSES_CREATE','COURSES','Create courses','2026-09-17 19:00:24','2026-09-17 19:00:24'),(10,'COURSES_EDIT','COURSES','Edit course details','2026-09-17 19:00:24','2026-09-17 19:00:24'),(11,'COURSES_DELETE','COURSES','Delete courses','2026-09-17 19:00:24','2026-09-17 19:00:24'),(12,'COURSES_VIEW_STUDENTS','COURSES','View a course\'s enrolled students','2026-09-17 19:00:24','2026-09-17 19:00:24'),(13,'COURSES_VIEW_GRADES','COURSES','View all students\' grades for a course','2026-09-17 19:00:24','2026-09-17 19:00:24'),(14,'COURSES_VIEW_OWN_GRADES','COURSES','View own grades for a course','2026-09-17 19:00:24','2026-09-17 19:00:24'),(15,'ASSIGNMENTS_VIEW','ASSIGNMENTS','View assignments','2026-09-17 19:00:24','2026-09-17 19:00:24'),(16,'ASSIGNMENTS_CREATE','ASSIGNMENTS','Create assignments','2026-09-17 19:00:24','2026-09-17 19:00:24'),(17,'ASSIGNMENTS_EDIT','ASSIGNMENTS','Edit/publish assignments','2026-09-17 19:00:24','2026-09-17 19:00:24'),(18,'ASSIGNMENTS_DELETE','ASSIGNMENTS','Delete assignments','2026-09-17 19:00:24','2026-09-17 19:00:24'),(19,'ASSIGNMENTS_VIEW_SUBMISSIONS','ASSIGNMENTS','View all submissions for an assignment','2026-09-17 19:00:24','2026-09-17 19:00:24'),(20,'ASSIGNMENTS_MANAGE_ANY','ASSIGNMENTS','Edit/delete any assignment regardless of ownership (bypasses the owning-instructor check)','2026-09-17 19:00:24','2026-09-17 19:00:24'),(21,'SUBMISSIONS_VIEW_OWN','SUBMISSIONS','View own submissions','2026-09-17 19:00:24','2026-09-17 19:00:24'),(22,'SUBMISSIONS_VIEW_ALL','SUBMISSIONS','View any student\'s submissions','2026-09-17 19:00:24','2026-09-17 19:00:24'),(23,'SUBMISSIONS_CREATE','SUBMISSIONS','Create/submit a submission','2026-09-17 19:00:24','2026-09-17 19:00:24'),(24,'SUBMISSIONS_GRADE','SUBMISSIONS','Grade a submission','2026-09-17 19:00:24','2026-09-17 19:00:24'),(25,'QUIZZES_VIEW','QUIZZES','View quizzes','2026-09-17 19:00:24','2026-09-17 19:00:24'),(26,'QUIZZES_CREATE','QUIZZES','Create quizzes','2026-09-17 19:00:24','2026-09-17 19:00:24'),(27,'QUIZZES_EDIT','QUIZZES','Edit quizzes','2026-09-17 19:00:24','2026-09-17 19:00:24'),(28,'QUIZZES_DELETE','QUIZZES','Delete quizzes','2026-09-17 19:00:24','2026-09-17 19:00:24'),(29,'QUIZZES_ATTEMPT','QUIZZES','Attempt/take a quiz','2026-09-17 19:00:24','2026-09-17 19:00:24'),(30,'QUIZZES_VIEW_RESULTS_OWN','QUIZZES','View own quiz results','2026-09-17 19:00:24','2026-09-17 19:00:24'),(31,'QUIZZES_VIEW_RESULTS_ALL','QUIZZES','View any student\'s quiz results','2026-09-17 19:00:24','2026-09-17 19:00:24'),(32,'QUIZZES_GRADE','QUIZZES','Grade quiz submissions','2026-09-17 19:00:24','2026-09-17 19:00:24'),(33,'QUIZ_QUESTIONS_VIEW_WITH_ANSWERS','QUIZ_QUESTIONS','View correct answers for quiz questions','2026-09-17 19:00:24','2026-09-17 19:00:24'),(34,'QUIZ_QUESTIONS_USE_AI_HINT','QUIZ_QUESTIONS','Request AI hints for a question','2026-09-17 19:00:24','2026-09-17 19:00:24'),(35,'QUIZ_QUESTIONS_RUN_CODE','QUIZ_QUESTIONS','Run/execute code for a coding question','2026-09-17 19:00:24','2026-09-17 19:00:24'),(36,'QUESTION_BANK_VIEW','QUESTION_BANK','View a course\'s question bank','2026-09-17 19:00:24','2026-09-17 19:00:24'),(37,'QUESTION_BANK_CREATE','QUESTION_BANK','Create question bank entries (incl. upload/AI-generate)','2026-09-17 19:00:24','2026-09-17 19:00:24'),(38,'QUESTION_BANK_EDIT','QUESTION_BANK','Edit question bank entries','2026-09-17 19:00:24','2026-09-17 19:00:24'),(39,'QUESTION_BANK_DELETE','QUESTION_BANK','Delete question bank entries','2026-09-17 19:00:24','2026-09-17 19:00:24'),(40,'GRADING_MANUAL_ASSESS','GRADING','Perform manual (paper-based) assessment scoring','2026-09-17 19:00:24','2026-09-17 19:00:24'),(41,'GRADING_OVERRIDE_SCORE','GRADING','Override an automatically computed score','2026-09-17 19:00:24','2026-09-17 19:00:24'),(42,'PROCTORING_MANAGE_SETTINGS','PROCTORING','Create/edit proctoring settings for a quiz','2026-09-17 19:00:24','2026-09-17 19:00:24'),(43,'PROCTORING_START_SESSION','PROCTORING','Start a proctoring session for own quiz attempt','2026-09-17 19:00:24','2026-09-17 19:00:24'),(44,'PROCTORING_VIEW_SESSIONS','PROCTORING','View any student\'s proctoring sessions','2026-09-17 19:00:24','2026-09-17 19:00:24'),(45,'PROCTORING_VIEW_OWN_SESSIONS','PROCTORING','View own proctoring sessions','2026-09-17 19:00:24','2026-09-17 19:00:24'),(46,'PROCTORING_JOIN_LIVE_STREAM','PROCTORING','Join a student\'s live proctoring stream','2026-09-17 19:00:24','2026-09-17 19:00:24'),(47,'PROCTORING_VIEW_ANALYTICS','PROCTORING','View proctoring analytics for a quiz','2026-09-17 19:00:24','2026-09-17 19:00:24'),(48,'PROCTORING_LOG_EVENTS','PROCTORING','Log proctoring events during own attempt','2026-09-17 19:00:24','2026-09-17 19:00:24'),(49,'REPORT_CARDS_VIEW_OWN','REPORT_CARDS','View own report card','2026-09-17 19:00:24','2026-09-17 19:00:24'),(50,'REPORT_CARDS_VIEW_ALL','REPORT_CARDS','View any student\'s report card','2026-09-17 19:00:24','2026-09-17 19:00:24'),(51,'REPORT_CARDS_CREATE','REPORT_CARDS','Create/build report cards','2026-09-17 19:00:24','2026-09-17 19:00:24'),(52,'REPORT_CARDS_EDIT','REPORT_CARDS','Edit report cards','2026-09-17 19:00:24','2026-09-17 19:00:24'),(53,'REPORT_CARDS_APPROVE','REPORT_CARDS','Approve submitted report cards','2026-09-17 19:00:24','2026-09-17 19:00:24'),(54,'REPORT_CARDS_EXPORT_PDF','REPORT_CARDS','Export report cards as PDF','2026-09-17 19:00:24','2026-09-17 19:00:24'),(55,'MANUAL_ASSESSMENTS_VIEW','MANUAL_ASSESSMENTS','View manual assessments','2026-09-17 19:00:24','2026-09-17 19:00:24'),(56,'MANUAL_ASSESSMENTS_CREATE','MANUAL_ASSESSMENTS','Create manual assessments','2026-09-17 19:00:24','2026-09-17 19:00:24'),(57,'MANUAL_ASSESSMENTS_EDIT','MANUAL_ASSESSMENTS','Edit manual assessments','2026-09-17 19:00:24','2026-09-17 19:00:24'),(58,'MANUAL_ASSESSMENTS_DELETE','MANUAL_ASSESSMENTS','Delete manual assessments','2026-09-17 19:00:24','2026-09-17 19:00:24'),(59,'DASHBOARD_VIEW_ADMIN','DASHBOARD','View the admin dashboard','2026-09-17 19:00:24','2026-09-17 19:00:24'),(60,'DASHBOARD_VIEW_INSTRUCTOR','DASHBOARD','View the instructor dashboard','2026-09-17 19:00:24','2026-09-17 19:00:24'),(61,'DASHBOARD_VIEW_STUDENT','DASHBOARD','View the student dashboard','2026-09-17 19:00:24','2026-09-17 19:00:24'),(62,'ACADEMICS_VIEW','ACADEMICS','View academic years/terms','2026-09-17 19:00:24','2026-09-17 19:00:24'),(63,'ACADEMICS_MANAGE_PERIODS','ACADEMICS','Switch/manage academic periods','2026-09-17 19:00:24','2026-09-17 19:00:24'),(64,'DATABASE_ADMIN_ACCESS','DATABASE_ADMIN','Access the raw database administration tool','2026-09-17 19:00:24','2026-09-17 19:00:24'),(65,'ROLES_PERMISSIONS_VIEW','ROLES_PERMISSIONS','View roles and the permission catalog','2026-09-17 19:00:24','2026-09-17 19:00:24'),(66,'ROLES_PERMISSIONS_MANAGE','ROLES_PERMISSIONS','Create/edit/delete roles and assign permissions','2026-09-17 19:00:24','2026-09-17 19:00:24'),(67,'QUIZZES_MANAGE_ANY','QUIZZES','Edit/delete any quiz regardless of ownership (bypasses the owning-instructor check)','2026-09-17 19:00:25','2026-09-17 19:00:25'),(68,'QUESTION_BANK_MANAGE_ANY','QUESTION_BANK','Edit/delete any question bank entry regardless of ownership','2026-09-17 19:00:25','2026-09-17 19:00:25');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `proctoring_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `proctoring_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` int NOT NULL,
  `severity` enum('low','medium','high','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'low',
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `metadata` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `screenshot_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `video_timestamp` int DEFAULT NULL,
  `reviewed` tinyint(1) NOT NULL DEFAULT '0',
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `event_type` enum('session_start','session_end','identity_verification','environment_scan','face_not_visible','multiple_faces','looking_away','tab_switch','window_minimized','browser_leave','suspicious_audio','device_disconnected','network_issue','screen_recording_start','screen_recording_stop','manual_flag','auto_flag','proctor_message','fullscreen_exited','camera_level_low','microphone_level_low','speaker_level_low','mobile_phone_detected','unauthorized_object_detected') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `session_id` (`session_id`),
  KEY `timestamp` (`timestamp`),
  KEY `severity` (`severity`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_proctoring_events_session_id` (`session_id`),
  KEY `idx_proctoring_events_timestamp` (`timestamp`),
  KEY `idx_proctoring_events_severity` (`severity`),
  KEY `proctoring_events_session_id` (`session_id`),
  KEY `proctoring_events_event_type` (`event_type`),
  KEY `proctoring_events_timestamp` (`timestamp`),
  KEY `proctoring_events_severity` (`severity`),
  CONSTRAINT `proctoring_events_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `proctoring_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `proctoring_events_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `proctoring_events` WRITE;
/*!40000 ALTER TABLE `proctoring_events` DISABLE KEYS */;
INSERT INTO `proctoring_events` VALUES (58,2,'low','2025-11-09 19:36:14','Proctoring session started','{\"browser_info\":\"{\\\"userAgent\\\":\\\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\\\",\\\"platform\\\":\\\"MacIntel\\\",\\\"language\\\":\\\"en-US\\\",\\\"cookieEnabled\\\":true,\\\"screenWidth\\\":1512,\\\"screenHeight\\\":982}\",\"system_info\":\"{\\\"platform\\\":\\\"MacIntel\\\",\\\"language\\\":\\\"en-US\\\",\\\"screenResolution\\\":\\\"1512x982\\\"}\",\"ip_address\":\"\",\"location_data\":null}',NULL,NULL,0,NULL,NULL,NULL,'2025-11-09 19:36:14','2025-11-09 19:36:14','session_start'),(59,3,'low','2025-11-15 16:54:37','Proctoring session started','{\"browser_info\":\"{\\\"userAgent\\\":\\\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\\\",\\\"platform\\\":\\\"MacIntel\\\",\\\"language\\\":\\\"en-US\\\",\\\"cookieEnabled\\\":true,\\\"screenWidth\\\":1512,\\\"screenHeight\\\":982}\",\"system_info\":\"{\\\"platform\\\":\\\"MacIntel\\\",\\\"language\\\":\\\"en-US\\\",\\\"screenResolution\\\":\\\"1512x982\\\"}\",\"ip_address\":\"\",\"location_data\":null}',NULL,NULL,0,NULL,NULL,NULL,'2025-11-15 16:54:37','2025-11-15 16:54:37','session_start'),(60,4,'low','2025-11-22 09:55:55','Proctoring session started','{\"browser_info\":\"{\\\"userAgent\\\":\\\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\\\",\\\"platform\\\":\\\"MacIntel\\\",\\\"language\\\":\\\"en-US\\\",\\\"cookieEnabled\\\":true,\\\"screenWidth\\\":1512,\\\"screenHeight\\\":982}\",\"system_info\":\"{\\\"platform\\\":\\\"MacIntel\\\",\\\"language\\\":\\\"en-US\\\",\\\"screenResolution\\\":\\\"1512x982\\\"}\",\"ip_address\":\"\",\"location_data\":null}',NULL,NULL,0,NULL,NULL,NULL,'2025-11-22 09:55:55','2025-11-22 09:55:55','session_start');
/*!40000 ALTER TABLE `proctoring_events` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `proctoring_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `proctoring_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quiz_id` int NOT NULL,
  `student_id` int NOT NULL,
  `proctor_id` int DEFAULT NULL,
  `session_token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('setup','active','paused','completed','terminated','flagged') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'setup',
  `mode` enum('live_proctoring','automated_proctoring','record_review') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'automated_proctoring',
  `start_time` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL,
  `duration_minutes` int DEFAULT NULL,
  `browser_info` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `system_info` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `identity_verified` tinyint(1) NOT NULL DEFAULT '0',
  `environment_verified` tinyint(1) NOT NULL DEFAULT '0',
  `flags_count` int NOT NULL DEFAULT '0',
  `risk_score` decimal(5,2) NOT NULL DEFAULT '0.00',
  `recording_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_connected` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Tracks if the student is currently connected to the proctoring session',
  `last_connection_time` datetime DEFAULT NULL COMMENT 'Timestamp of the student''s last connection to the session',
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_token` (`session_token`),
  KEY `quiz_id` (`quiz_id`),
  KEY `student_id` (`student_id`),
  KEY `proctor_id` (`proctor_id`),
  KEY `status` (`status`),
  KEY `start_time` (`start_time`),
  KEY `idx_proctoring_sessions_session_token` (`session_token`),
  KEY `idx_proctoring_sessions_quiz_id` (`quiz_id`),
  KEY `idx_proctoring_sessions_student_id` (`student_id`),
  KEY `idx_proctoring_sessions_status` (`status`),
  KEY `idx_proctoring_sessions_start_time` (`start_time`),
  KEY `proctoring_sessions_session_token` (`session_token`),
  KEY `proctoring_sessions_quiz_id` (`quiz_id`),
  KEY `proctoring_sessions_student_id` (`student_id`),
  KEY `proctoring_sessions_status` (`status`),
  KEY `proctoring_sessions_start_time` (`start_time`),
  CONSTRAINT `proctoring_sessions_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `proctoring_sessions_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `proctoring_sessions_ibfk_3` FOREIGN KEY (`proctor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `proctoring_sessions` WRITE;
/*!40000 ALTER TABLE `proctoring_sessions` DISABLE KEYS */;
INSERT INTO `proctoring_sessions` VALUES (2,9,3,NULL,'proctor_9_3_1762716974431_gg94deagn','active','live_proctoring','2025-11-09 19:36:14',NULL,NULL,'{\"userAgent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\",\"platform\":\"MacIntel\",\"language\":\"en-US\",\"cookieEnabled\":true,\"screenWidth\":1512,\"screenHeight\":982}','{\"platform\":\"MacIntel\",\"language\":\"en-US\",\"screenResolution\":\"1512x982\"}','',NULL,0,0,0,0.00,NULL,NULL,'2025-11-09 19:36:14','2025-11-09 19:36:14',1,'2025-11-09 19:36:14'),(3,10,3,NULL,'proctor_10_3_1763225677972_yrlzkxai8','active','live_proctoring','2025-11-15 16:54:37',NULL,NULL,'{\"userAgent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\",\"platform\":\"MacIntel\",\"language\":\"en-US\",\"cookieEnabled\":true,\"screenWidth\":1512,\"screenHeight\":982}','{\"platform\":\"MacIntel\",\"language\":\"en-US\",\"screenResolution\":\"1512x982\"}','',NULL,0,0,0,0.00,NULL,NULL,'2025-11-15 16:54:37','2025-11-15 16:54:37',1,'2025-11-15 16:54:37'),(4,10,4,NULL,'proctor_10_4_1763805355700_tu13ntcqq','active','live_proctoring','2025-11-22 09:55:55',NULL,NULL,'{\"userAgent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\",\"platform\":\"MacIntel\",\"language\":\"en-US\",\"cookieEnabled\":true,\"screenWidth\":1512,\"screenHeight\":982}','{\"platform\":\"MacIntel\",\"language\":\"en-US\",\"screenResolution\":\"1512x982\"}','',NULL,0,0,0,0.00,NULL,NULL,'2025-11-22 09:55:55','2025-11-22 09:55:55',1,'2025-11-22 09:55:55');
/*!40000 ALTER TABLE `proctoring_sessions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `proctoring_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `proctoring_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quiz_id` int NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `mode` enum('automated','live','record_review','disabled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'automated',
  `require_identity_verification` tinyint(1) NOT NULL DEFAULT '1',
  `require_environment_scan` tinyint(1) NOT NULL DEFAULT '1',
  `allow_screen_recording` tinyint(1) NOT NULL DEFAULT '1',
  `allow_audio_monitoring` tinyint(1) NOT NULL DEFAULT '1',
  `allow_video_monitoring` tinyint(1) NOT NULL DEFAULT '1',
  `lockdown_browser` tinyint(1) NOT NULL DEFAULT '1',
  `prevent_tab_switching` tinyint(1) NOT NULL DEFAULT '1',
  `prevent_window_minimization` tinyint(1) NOT NULL DEFAULT '1',
  `prevent_copy_paste` tinyint(1) NOT NULL DEFAULT '1',
  `prevent_right_click` tinyint(1) NOT NULL DEFAULT '1',
  `max_flags_allowed` int NOT NULL DEFAULT '5',
  `auto_terminate_on_high_risk` tinyint(1) NOT NULL DEFAULT '0',
  `risk_threshold` decimal(5,2) NOT NULL DEFAULT '75.00',
  `require_proctor_approval` tinyint(1) NOT NULL DEFAULT '0',
  `recording_retention_days` int NOT NULL DEFAULT '90',
  `allow_multiple_faces` tinyint(1) NOT NULL DEFAULT '0',
  `face_detection_sensitivity` decimal(5,2) NOT NULL DEFAULT '70.00',
  `suspicious_behavior_detection` tinyint(1) NOT NULL DEFAULT '1',
  `alert_instructors` tinyint(1) NOT NULL DEFAULT '1',
  `alert_emails` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `custom_instructions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `require_fullscreen` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Require student to stay in fullscreen mode during quiz',
  `min_camera_level` decimal(5,2) NOT NULL DEFAULT '50.00' COMMENT 'Minimum camera activity level required (0-100%)',
  `min_microphone_level` decimal(5,2) NOT NULL DEFAULT '50.00' COMMENT 'Minimum microphone activity level required (0-100%)',
  `min_speaker_level` decimal(5,2) NOT NULL DEFAULT '50.00' COMMENT 'Minimum speaker volume level required (0-100%)',
  `enable_face_detection` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Enable face detection to ensure student face is visible',
  `enable_object_detection` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Enable object detection to prevent unauthorized materials',
  `object_detection_sensitivity` decimal(5,2) NOT NULL DEFAULT '70.00' COMMENT 'Sensitivity for object detection (0-100%)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `quiz_id` (`quiz_id`),
  KEY `enabled` (`enabled`),
  KEY `idx_proctoring_settings_quiz_id` (`quiz_id`),
  KEY `idx_proctoring_settings_enabled` (`enabled`),
  KEY `proctoring_settings_quiz_id` (`quiz_id`),
  KEY `proctoring_settings_enabled` (`enabled`),
  CONSTRAINT `proctoring_settings_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `proctoring_settings` WRITE;
/*!40000 ALTER TABLE `proctoring_settings` DISABLE KEYS */;
INSERT INTO `proctoring_settings` VALUES (1,9,1,'live',1,1,1,1,1,1,1,1,1,1,5,0,75.00,1,90,0,70.00,1,1,NULL,NULL,'2025-11-07 21:10:02','2025-11-07 22:49:24',1,50.00,50.00,50.00,1,1,70.00),(2,10,1,'live',1,1,1,1,1,1,1,1,1,1,5,0,75.00,0,90,0,70.00,1,1,'emmanuelniyongabo44@gmail.com',NULL,'2025-11-15 16:54:05','2025-11-15 16:54:05',1,50.00,50.00,50.00,1,1,70.00);
/*!40000 ALTER TABLE `proctoring_settings` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `question_bank`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `question_bank` (
  `id` int NOT NULL AUTO_INCREMENT,
  `course_id` int NOT NULL,
  `question_type` enum('single_choice','multiple_choice','true_false','matching','fill_blank','dropdown','numerical','algorithmic','short_answer','coding','logical_expression','drag_drop','ordering') COLLATE utf8mb4_unicode_ci NOT NULL,
  `question_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `question_data` json NOT NULL,
  `correct_answer` json DEFAULT NULL,
  `explanation` text COLLATE utf8mb4_unicode_ci,
  `attachments` text COLLATE utf8mb4_unicode_ci,
  `created_by` int NOT NULL,
  `academic_term_id` int DEFAULT NULL,
  `blooms_taxonomy_level_id` int DEFAULT NULL,
  `tags` text COLLATE utf8mb4_unicode_ci,
  `difficulty_level` enum('EASY','MEDIUM','DIFFICULT') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `time_limit_seconds` int DEFAULT '60',
  `scheme_of_work_entry_id` int DEFAULT NULL,
  `scheme_of_work_entry_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `blooms_taxonomy_level_id` (`blooms_taxonomy_level_id`),
  CONSTRAINT `question_bank_ibfk_1` FOREIGN KEY (`blooms_taxonomy_level_id`) REFERENCES `blooms_taxonomy_levels` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `question_bank` WRITE;
/*!40000 ALTER TABLE `question_bank` DISABLE KEYS */;
/*!40000 ALTER TABLE `question_bank` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `question_difficulty`;
/*!50001 DROP VIEW IF EXISTS `question_difficulty`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `question_difficulty` AS SELECT 
 1 AS `question_id`,
 1 AS `quiz_id`,
 1 AS `question_type`,
 1 AS `points`,
 1 AS `total_attempts`,
 1 AS `correct_attempts`,
 1 AS `success_rate`,
 1 AS `average_points_earned`,
 1 AS `average_time_seconds`*/;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `quiz_analytics`;
/*!50001 DROP VIEW IF EXISTS `quiz_analytics`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `quiz_analytics` AS SELECT 
 1 AS `quiz_id`,
 1 AS `title`,
 1 AS `course_id`,
 1 AS `total_submissions`,
 1 AS `average_score`,
 1 AS `average_time_minutes`,
 1 AS `pass_rate`,
 1 AS `completed_submissions`,
 1 AS `graded_submissions`*/;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `quiz_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quiz_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quiz_id` int NOT NULL,
  `question_id` int NOT NULL,
  `student_id` int NOT NULL,
  `answer_data` json NOT NULL,
  `is_correct` tinyint(1) DEFAULT NULL,
  `points_earned` decimal(5,2) DEFAULT NULL,
  `time_taken` int DEFAULT NULL,
  `status` enum('in_progress','completed','timed_out','abandoned') NOT NULL DEFAULT 'in_progress',
  `started_at` datetime NOT NULL,
  `completed_at` datetime DEFAULT NULL,
  `submission_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `submitted_answer` json DEFAULT NULL,
  `correct_answer` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `question_id` (`question_id`),
  KEY `student_id` (`student_id`),
  KEY `submission_id` (`submission_id`),
  KEY `idx_quiz_attempts_quiz_question_student` (`quiz_id`,`question_id`,`student_id`),
  CONSTRAINT `quiz_attempts_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `quiz_attempts_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `quiz_questions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `quiz_attempts_ibfk_3` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `quiz_attempts_ibfk_4` FOREIGN KEY (`submission_id`) REFERENCES `quiz_submissions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `quiz_attempts` WRITE;
/*!40000 ALTER TABLE `quiz_attempts` DISABLE KEYS */;
INSERT INTO `quiz_attempts` VALUES (5,6,14,3,'{\"selected_option_indices\": [0]}',0,0.00,1719,'completed','2025-10-28 15:43:50',NULL,1,'2025-10-28 15:43:50','2025-10-28 15:43:50','{\"selected_option_indices\": [0]}','{\"correct_option_indices\": [1]}'),(6,6,15,3,'{\"selected_option_indices\": [0]}',0,0.00,5935,'completed','2025-10-28 15:43:50',NULL,1,'2025-10-28 15:43:50','2025-10-28 15:43:50','{\"selected_option_indices\": [0]}','{\"correct_option_indices\": [3]}'),(7,3,20,3,'{\"code\": \"function twoSum(nums, target) {\\n  const map = new Map(); // store number -> index\\n  for (let i = 0; i < nums.length; i++) {\\n    const complement = target - nums[i];\\n    if (map.has(complement)) {\\n      return [map.get(complement), i]; // found the pair\\n    }\\n    map.set(nums[i], i); // store the index of the current number\\n  }\\n  return []; // no solution found\\n}\", \"score\": 0, \"language\": \"javascript\", \"submitted\": true, \"testResults\": [false]}',1,5.00,151553,'completed','2025-11-04 08:21:41',NULL,2,'2025-11-04 08:21:41','2025-11-04 08:21:41','{\"code\": \"function twoSum(nums, target) {\\n  const map = new Map(); // store number -> index\\n  for (let i = 0; i < nums.length; i++) {\\n    const complement = target - nums[i];\\n    if (map.has(complement)) {\\n      return [map.get(complement), i]; // found the pair\\n    }\\n    map.set(nums[i], i); // store the index of the current number\\n  }\\n  return []; // no solution found\\n}\", \"score\": 0, \"language\": \"javascript\", \"submitted\": true, \"testResults\": [false]}',NULL),(8,3,21,3,'{\"code\": \"function fibonacci(n) {\\n  if (n < 0) return null;      // invalid input\\n  if (n === 0) return 0;\\n  if (n === 1) return 1;\\n\\n  let a = 0, b = 1;\\n\\n  for (let i = 2; i <= n; i++) {\\n    const next = a + b;\\n    a = b;\\n    b = next;\\n  }\\n\\n  return b;\\n}\", \"score\": 50, \"language\": \"javascript\", \"submitted\": true, \"testResults\": [true, false, true, false]}',1,5.00,90075,'completed','2025-11-04 08:21:41',NULL,2,'2025-11-04 08:21:41','2025-11-04 08:21:41','{\"code\": \"function fibonacci(n) {\\n  if (n < 0) return null;      // invalid input\\n  if (n === 0) return 0;\\n  if (n === 1) return 1;\\n\\n  let a = 0, b = 1;\\n\\n  for (let i = 2; i <= n; i++) {\\n    const next = a + b;\\n    a = b;\\n    b = next;\\n  }\\n\\n  return b;\\n}\", \"score\": 50, \"language\": \"javascript\", \"submitted\": true, \"testResults\": [true, false, true, false]}',NULL),(10,4,10,3,'{\"selected_option_indices\": [2]}',0,0.00,21657,'timed_out','2025-11-05 18:42:20',NULL,3,'2025-11-05 18:42:20','2025-11-05 18:42:20','{\"selected_option_indices\": [2]}','{\"correct_option_indices\": [3]}'),(11,4,9,3,'{\"selected_option_indices\": [0]}',0,0.00,2540,'timed_out','2025-11-05 18:42:21',NULL,3,'2025-11-05 18:42:21','2025-11-05 18:42:21','{\"selected_option_indices\": [0]}','{\"correct_option_indices\": [1]}'),(13,4,10,3,'{\"selected_option_indices\": [2]}',0,0.00,370138,'timed_out','2025-11-05 18:42:21',NULL,3,'2025-11-05 18:42:21','2025-11-05 18:42:21','{\"selected_option_indices\": [2]}','{\"correct_option_indices\": [3]}'),(16,4,9,3,'{\"selected_option_indices\": [0]}',0,0.00,2540,'timed_out','2025-11-05 18:42:21',NULL,3,'2025-11-05 18:42:21','2025-11-05 18:42:21','{\"selected_option_indices\": [0]}','{\"correct_option_indices\": [1]}'),(19,7,16,3,'{\"selected_option_indices\": [0]}',0,0.00,4724,'timed_out','2025-11-05 19:04:09',NULL,4,'2025-11-05 19:04:09','2025-11-05 19:04:09','{\"selected_option_indices\": [0]}','{\"correct_option_indices\": [0]}'),(20,7,17,3,'{\"selected_option_indices\": [0]}',0,0.00,15565,'timed_out','2025-11-05 19:04:09',NULL,4,'2025-11-05 19:04:09','2025-11-05 19:04:09','{\"selected_option_indices\": [0]}','{\"correct_option_indices\": [2]}'),(21,7,18,3,'{\"selected_option_indices\": [1]}',0,0.00,17989,'timed_out','2025-11-05 19:04:09',NULL,4,'2025-11-05 19:04:09','2025-11-05 19:04:09','{\"selected_option_indices\": [1]}','{\"correct_option_indices\": [1]}'),(22,5,11,3,'{\"selected_option_indices\": [1]}',0,0.00,3619,'timed_out','2025-11-05 21:32:27',NULL,7,'2025-11-05 21:32:27','2025-11-05 21:32:27','{\"selected_option_indices\": [1]}','{\"correct_option_indices\": [0]}'),(23,5,12,3,'{\"selected_option_indices\": [1]}',0,0.00,9075,'timed_out','2025-11-05 21:32:27',NULL,7,'2025-11-05 21:32:27','2025-11-05 21:32:27','{\"selected_option_indices\": [1]}','{\"correct_option_indices\": [2]}'),(24,5,13,3,'{\"selected_option_indices\": [1]}',0,0.00,11650,'timed_out','2025-11-05 21:32:27',NULL,7,'2025-11-05 21:32:27','2025-11-05 21:32:27','{\"selected_option_indices\": [1]}','{\"correct_option_indices\": [1]}'),(25,10,25,3,'{\"selected_option_index\": 1}',0,0.00,3454,'timed_out','2025-11-15 16:57:01',NULL,10,'2025-11-15 16:57:01','2025-11-15 16:57:01','{\"selected_option_index\": 1}',NULL),(26,10,24,3,'{\"selected_option_index\": 2}',0,0.00,8579,'timed_out','2025-11-15 16:57:01',NULL,10,'2025-11-15 16:57:01','2025-11-15 16:57:01','{\"selected_option_index\": 2}',NULL),(27,10,26,3,'{\"selected_option_index\": 2}',0,0.00,11181,'timed_out','2025-11-15 16:57:01',NULL,10,'2025-11-15 16:57:01','2025-11-15 16:57:01','{\"selected_option_index\": 2}',NULL),(28,10,27,3,'{\"selected_answer\": true}',0,0.00,21075,'timed_out','2025-11-15 16:57:01',NULL,10,'2025-11-15 16:57:01','2025-11-15 16:57:01','{\"selected_answer\": true}',NULL),(29,10,28,3,'{\"selected_answer\": false}',0,0.00,34869,'timed_out','2025-11-15 16:57:01',NULL,10,'2025-11-15 16:57:01','2025-11-15 16:57:01','{\"selected_answer\": false}',NULL),(30,10,30,3,'{\"code\": \"<!DOCTYPE html>\\n<html lang=\\\"en\\\">\\n<head>\\n    <meta charset=\\\"UTF-8\\\">\\n    <meta name=\\\"viewport\\\" content=\\\"width=device-width, initial-scale=1.0\\\">\\n    <title>My Page</title>\\n</head>\\n<body>\\n    <h1>This is the title</h1>\\n</body>\\n</html>\", \"score\": 66.66666666666666, \"language\": \"html\", \"submitted\": true, \"testResults\": [true, true, false]}',0,0.00,83864,'timed_out','2025-11-15 16:57:01',NULL,10,'2025-11-15 16:57:01','2025-11-15 16:57:01','{\"code\": \"<!DOCTYPE html>\\n<html lang=\\\"en\\\">\\n<head>\\n    <meta charset=\\\"UTF-8\\\">\\n    <meta name=\\\"viewport\\\" content=\\\"width=device-width, initial-scale=1.0\\\">\\n    <title>My Page</title>\\n</head>\\n<body>\\n    <h1>This is the title</h1>\\n</body>\\n</html>\", \"score\": 66.66666666666666, \"language\": \"html\", \"submitted\": true, \"testResults\": [true, true, false]}',NULL),(31,10,31,3,'{\"code\": \"function twoSum(nums, target) {\\n  const seen = new Map();\\n\\n  for (let i = 0; i < nums.length; i++) {\\n    const diff = target - nums[i];\\n\\n    if (seen.has(diff)) {\\n      return `[${seen.get(diff)},${i}]`; // return string format\\n    }\\n\\n    seen.set(nums[i], i);\\n  }\\n\\n  return \\\"[]\\\"; // return empty array in string form\\n}\", \"score\": 100, \"language\": \"javascript\", \"submitted\": true, \"testResults\": [true]}',0,0.00,135213,'timed_out','2025-11-15 16:57:01',NULL,10,'2025-11-15 16:57:01','2025-11-15 16:57:01','{\"code\": \"function twoSum(nums, target) {\\n  const seen = new Map();\\n\\n  for (let i = 0; i < nums.length; i++) {\\n    const diff = target - nums[i];\\n\\n    if (seen.has(diff)) {\\n      return `[${seen.get(diff)},${i}]`; // return string format\\n    }\\n\\n    seen.set(nums[i], i);\\n  }\\n\\n  return \\\"[]\\\"; // return empty array in string form\\n}\", \"score\": 100, \"language\": \"javascript\", \"submitted\": true, \"testResults\": [true]}',NULL),(34,10,25,4,'{\"selected_option_index\": 1}',0,0.00,38598,'timed_out','2025-11-24 15:28:43',NULL,11,'2025-11-24 15:28:43','2025-11-24 15:28:43','{\"selected_option_index\": 1}',NULL),(36,10,24,4,'{\"selected_option_index\": 2}',0,0.00,50847,'timed_out','2025-11-24 15:28:43',NULL,11,'2025-11-24 15:28:43','2025-11-24 15:28:43','{\"selected_option_index\": 2}',NULL),(38,10,26,4,'{\"selected_option_index\": 2}',0,0.00,62297,'timed_out','2025-11-24 15:28:43',NULL,11,'2025-11-24 15:28:43','2025-11-24 15:28:43','{\"selected_option_index\": 2}',NULL),(40,10,27,4,'{\"selected_answer\": true}',0,0.00,72480,'timed_out','2025-11-24 15:28:43',NULL,11,'2025-11-24 15:28:43','2025-11-24 15:28:43','{\"selected_answer\": true}',NULL),(42,10,28,4,'{\"selected_answer\": true}',0,0.00,80660,'timed_out','2025-11-24 15:28:43',NULL,11,'2025-11-24 15:28:43','2025-11-24 15:28:43','{\"selected_answer\": true}',NULL);
/*!40000 ALTER TABLE `quiz_attempts` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `quiz_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quiz_questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quiz_id` int NOT NULL,
  `question_type` enum('single_choice','multiple_choice','true_false','matching','fill_blank','dropdown','numerical','algorithmic','short_answer','coding','logical_expression','drag_drop','ordering') NOT NULL,
  `question_text` text NOT NULL,
  `question_data` json NOT NULL,
  `correct_answer` json DEFAULT NULL,
  `explanation` text,
  `points` decimal(5,2) NOT NULL,
  `order` int NOT NULL,
  `time_limit` int DEFAULT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `time_limit_seconds` int DEFAULT NULL COMMENT 'Time limit for this specific question in seconds',
  `created_by` int NOT NULL,
  `attachments` text,
  PRIMARY KEY (`id`),
  KEY `idx_quiz_questions_quiz_order` (`quiz_id`,`order`),
  CONSTRAINT `quiz_questions_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `quiz_questions` WRITE;
/*!40000 ALTER TABLE `quiz_questions` DISABLE KEYS */;
INSERT INTO `quiz_questions` VALUES (1,1,'single_choice','Choose correct answer','{\"options\": [\"This is the stesp1\", \"This is the stesp2\", \"This is ok\"], \"correct_option_index\": 1}',NULL,'Ok',1.00,2,20000,1,'2025-10-25 16:22:09','2025-10-27 12:38:30',180,0,NULL),(2,1,'matching','Match correct item for correspondance','{\"left_items\": [{\"id\": \"1\", \"text\": \"Input components\"}, {\"id\": \"2\", \"text\": \"Output components\"}], \"right_items\": [{\"id\": \"1\", \"text\": \"Forms\"}, {\"id\": \"2\", \"text\": \"Labels\"}], \"correct_matches\": {\"1\": \"1\", \"2\": \"2\"}}',NULL,'This is the question ',1.00,3,20000,1,'2025-10-26 09:44:38','2025-10-27 12:38:30',180,0,NULL),(3,1,'coding','sdfsdfassdafsdafafasd','{\"language\": \"java\", \"test_cases\": [{\"id\": \"1\", \"input\": \"sdaf\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"asdf\"}], \"starter_code\": \"public int fibonacci(int n) {\\n    // Your solution here\\n}\"}',NULL,'',1.00,1,20000,1,'2025-10-26 15:32:43','2025-10-27 12:38:30',180,0,NULL),(4,1,'coding','Design your portifolio using HTML','{\"language\": \"html\", \"test_cases\": [{\"id\": \"1\", \"input\": \"Ok\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"Ok\"}], \"starter_code\": \"<nav>\\n    <ul>\\n        <li><a href=\\\"/\\\">Home</a></li>\\n        <li><a href=\\\"/about\\\">About</a></li>\\n        <li><a href=\\\"/services\\\">Services</a></li>\\n        <li><a href=\\\"/contact\\\">Contact</a></li>\\n    </ul>\\n</nav>\"}',NULL,NULL,1.00,4,20000,1,'2025-10-26 15:42:11','2025-10-27 12:38:30',180,0,NULL),(5,1,'coding','Work on the following scenario','{\"language\": \"react\", \"test_cases\": [{\"id\": \"1\", \"input\": \"234\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"324234\"}], \"constraints\": \"This is the contraints\", \"starter_code\": \"import React, { useState, useEffect } from \'react\';\\n\\nfunction Counter() {\\n    const [count, setCount] = useState(0);\\n    \\n    useEffect(() => {\\n        document.title = `Count: ${count}`;\\n    }, [count]);\\n    \\n    return (\\n        <div>\\n            <h1>{count}</h1>\\n            <button onClick={() => setCount(count + 1)}>\\n                Increment\\n            </button>\\n        </div>\\n    );\\n}\\n\\nexport default Counter;\"}',NULL,'Work on this assignment',1.00,5,20000,1,'2025-10-27 14:23:03','2025-10-27 14:23:03',180,0,NULL),(6,2,'coding','Calculate nth Fibonacci number','{\"language\": \"javascript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"2\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"23\"}], \"constraints\": \"This is the the contrains\", \"starter_code\": \"function fibonacci(n) {\\n  // Your solution here\\n}\"}',NULL,'The explaination here',5.00,1,20000,1,'2025-10-27 15:06:06','2025-10-27 15:06:06',180,0,NULL),(7,2,'single_choice','This is the testing other question','{\"options\": [\"Option 1\", \"Option 2\"], \"correct_option_index\": 1}',NULL,'This is the explaination',5.00,2,20000,1,'2025-10-27 15:07:05','2025-10-27 15:07:05',180,0,NULL),(8,2,'matching','This is matching question','{\"left_items\": [{\"id\": \"1\", \"text\": \"Term 1\"}, {\"id\": \"2\", \"text\": \"Term 2\"}], \"right_items\": [{\"id\": \"1\", \"text\": \"Def 1\"}, {\"id\": \"2\", \"text\": \"Def 2\"}], \"correct_matches\": {\"1\": \"2\", \"2\": \"1\"}}',NULL,'This is the xpla',10.00,3,20000,1,'2025-10-27 15:07:46','2025-10-27 15:07:46',180,0,NULL),(9,4,'multiple_choice','What is the correct way to declare a variable in JavaScript?','{\"options\": [\"variable x = 5;\", \"var x = 5;\", \"v x = 5;\", \"declare x = 5;\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [1]}',NULL,'The var keyword is used to declare variables in JavaScript.',10.00,1,20000,1,'2025-10-27 17:22:47','2025-10-27 17:22:47',180,0,NULL),(10,4,'multiple_choice','Which of the following is NOT a JavaScript data type?','{\"options\": [\"string\", \"number\", \"boolean\", \"character\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [3]}',NULL,'JavaScript does not have a character data type. It uses strings for text.',10.00,2,20000,1,'2025-10-27 17:22:47','2025-10-27 17:22:47',180,0,NULL),(11,5,'multiple_choice','What does HTML stand for?','{\"options\": [\"Hypertext Markup Language\", \"High Tech Modern Language\", \"Home Tool Markup Language\", \"Hyperlink and Text Markup Language\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [0]}',NULL,'HTML stands for Hypertext Markup Language.',15.00,1,20000,1,'2025-10-27 17:22:47','2025-10-27 17:22:47',180,0,NULL),(12,5,'multiple_choice','Which CSS property is used to change the text color?','{\"options\": [\"font-color\", \"text-color\", \"color\", \"foreground-color\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [2]}',NULL,'The color property is used to set the color of text.',15.00,2,20000,1,'2025-10-27 17:22:47','2025-10-27 17:22:47',180,0,NULL),(13,5,'multiple_choice','What is the purpose of CSS in web development?','{\"options\": [\"To structure web pages\", \"To style web pages\", \"To add interactivity\", \"To connect to databases\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [1]}',NULL,'CSS (Cascading Style Sheets) is used to describe the presentation of a document written in HTML.',20.00,3,20000,1,'2025-10-27 17:22:47','2025-10-27 17:22:47',180,0,NULL),(14,6,'multiple_choice','What is the correct way to declare a variable in JavaScript?','{\"options\": [\"variable x = 5;\", \"var x = 5;\", \"v x = 5;\", \"declare x = 5;\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [1]}',NULL,'The var keyword is used to declare variables in JavaScript.',10.00,1,20000,1,'2025-10-27 17:29:57','2025-10-27 17:29:57',180,0,NULL),(15,6,'multiple_choice','Which of the following is NOT a JavaScript data type?','{\"options\": [\"string\", \"number\", \"boolean\", \"character\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [3]}',NULL,'JavaScript does not have a character data type. It uses strings for text.',10.00,2,20000,1,'2025-10-27 17:29:57','2025-10-27 17:29:57',180,0,NULL),(16,7,'multiple_choice','What does HTML stand for?','{\"options\": [\"Hypertext Markup Language\", \"High Tech Modern Language\", \"Home Tool Markup Language\", \"Hyperlink and Text Markup Language\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [0]}',NULL,'HTML stands for Hypertext Markup Language.',15.00,1,20000,1,'2025-10-27 17:29:57','2025-10-27 17:29:57',180,0,NULL),(17,7,'multiple_choice','Which CSS property is used to change the text color?','{\"options\": [\"font-color\", \"text-color\", \"color\", \"foreground-color\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [2]}',NULL,'The color property is used to set the color of text.',15.00,2,20000,1,'2025-10-27 17:29:57','2025-10-27 17:29:57',180,0,NULL),(18,7,'multiple_choice','What is the purpose of CSS in web development?','{\"options\": [\"To structure web pages\", \"To style web pages\", \"To add interactivity\", \"To connect to databases\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [1]}',NULL,'CSS (Cascading Style Sheets) is used to describe the presentation of a document written in HTML.',20.00,3,20000,1,'2025-10-27 17:29:57','2025-10-27 17:29:57',180,0,NULL),(19,6,'coding','This coding question for testing','{\"language\": \"javascript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"Ok\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"Ok\"}], \"constraints\": \"This is the instruction\", \"starter_code\": \"function isPalindrome(str) {\\n  // Your solution here\\n}\"}',NULL,'This is the explaination',5.00,3,20000,1,'2025-11-03 16:14:44','2025-11-03 16:14:44',180,0,NULL),(20,3,'coding','This is the other testing question for coding','{\"language\": \"javascript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"This is ok\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"This is ok\"}], \"constraints\": \"This is good contraint here\", \"starter_code\": \"function twoSum(nums, target) {\\n  // Your solution here\\n}\"}',NULL,'This is the explaination',5.00,1,20000,1,'2025-11-03 16:16:02','2025-11-03 16:16:02',180,0,NULL),(21,3,'coding','Write a program that prints the first n numbers in the Fibonacci sequence.\nThe Fibonacci sequence starts with 0 and 1, and each subsequent number is the sum of the two preceding ones.\nMathematically:\nF(0) = 0\nF(1) = 1\nF(n) = F(n-1) + F(n-2), for n ≥ 2','{\"language\": \"javascript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"5\", \"points\": 10, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"5\"}, {\"id\": \"2\", \"input\": \"10\", \"points\": 15, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"55\"}, {\"id\": \"3\", \"input\": \"0\", \"points\": 10, \"is_hidden\": true, \"time_limit\": 5000, \"expected_output\": \"0\"}, {\"id\": \"4\", \"input\": \"20\", \"points\": 15, \"is_hidden\": true, \"time_limit\": 5000, \"expected_output\": \"6765\"}], \"constraints\": \"You must write clean, well-commented code in your preferred programming language (Python, C++, Java, or JavaScript).\\nThe program must:\\nTake an integer input n from the user.\\nValidate the input (must be a positive integer greater than 1).\\n\\nDisplay the sequence in one line separated by spaces.\\n\\nInclude both an iterative and a recursive approach (two functions).\\n\\nClearly print labels like:\\n\\nIterative Fibonacci:\\n0 1 1 2 3 5 8\\n\\nRecursive Fibonacci:\\n0 1 1 2 3 5 8\\n\\nHandle invalid inputs gracefully (e.g., display an error message if the user enters text or a negative number).\\nYou must include comments explaining:\\nBase case(s)\\nRecursive relation\\nTime and space complexity\", \"starter_code\": \"function fibonacci(n) {\\n  // Your solution here\\n}\"}',NULL,'This is the testing question',5.00,2,20000,1,'2025-11-03 22:09:01','2025-11-03 22:09:01',180,0,NULL),(22,8,'coding','Write a function named fibonacci(n) that returns the nth Fibonacci number.\nThe Fibonacci sequence is defined as follows:\n\nF(0) = 0  \nF(1) = 1  \nF(n) = F(n - 1) + F(n - 2)  for n > 1\n\nExample of the sequence:\n0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, ...','{\"language\": \"javascript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"5\", \"points\": 10, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"5\"}, {\"id\": \"2\", \"input\": \"10\", \"points\": 15, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"55\"}, {\"id\": \"3\", \"input\": \"0\", \"points\": 10, \"is_hidden\": true, \"time_limit\": 5000, \"expected_output\": \"0\"}, {\"id\": \"4\", \"input\": \"20\", \"points\": 15, \"is_hidden\": true, \"time_limit\": 5000, \"expected_output\": \"6765\"}], \"constraints\": \"Implement your function in JavaScript as follows:\\n\\nfunction fibonacci(n) {\\n  // Your solution here\\n}\\n\\n- Do not use recursion for this task. Use a loop-based (iterative) approach.\\n- Ensure your solution works efficiently for large values of n (up to 50).\", \"starter_code\": \"function fibonacci(n) {\\n  // Your solution here\\n}\"}',NULL,'This is the explaination',5.00,1,20000,1,'2025-11-04 13:30:09','2025-11-04 13:30:09',180,0,NULL),(23,9,'coding','You are given an array of integers nums where every element appears twice, except for one element which appears only once.\nWrite a TypeScript function that returns the single element that appears once.\n\nYou must implement a TypeScript function that:\n\nTakes an array of numbers as input.\n\nReturns the number that appears only once.\n\nFunction Signature:\nfunction findUnique(nums: number[]): number;','{\"language\": \"typescript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"console.log(findUnique([2, 2, 1]));\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"1\"}, {\"id\": \"2\", \"input\": \"console.log(findUnique([4, 1, 2, 1, 2]));\", \"points\": 10, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"4\"}, {\"id\": \"3\", \"input\": \"console.log(findUnique([7]));\", \"points\": 10, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"7\"}], \"constraints\": \"a) 1 <= nums.length <= 10^5\\n\\nb) -10^5 <= nums[i] <= 10^5\\n\\nc) Each element appears exactly twice except for one element.\", \"starter_code\": \"interface User {\\n  id: number;\\n  name: string;\\n  email: string;\\n  isActive: boolean;\\n}\\n\\nfunction createUser(name: string, email: string): User {\\n  return {\\n    id: Math.floor(Math.random() * 1000),\\n    name,\\n    email,\\n    isActive: true\\n  }\\n}\\n\\nconst user = createUser(\'John Doe\', \'john@example.com\')\\nconsole.log(user)\"}',NULL,NULL,1.00,1,NULL,1,'2025-11-07 18:52:06','2025-11-07 18:52:06',320,0,NULL),(24,10,'single_choice','Which of the following best describes responsive design?','{\"options\": [\"Designing separate sites for mobile and desktop\", \"Using breakpoints, fluid grids and flexible images so layout adapts to viewport size\", \"Optimizing images for faster load only\", \"Hiding content on small screens to simplify pages\", \"None of above\"], \"correct_option_index\": 1}',NULL,NULL,1.00,2,NULL,1,'2025-11-14 18:42:58','2025-11-14 19:42:33',60,0,NULL),(25,10,'single_choice','The CSS flex shorthand sets which three values?','{\"options\": [\"flex-direction, flex-wrap, justify-content\", \"flex-grow, flex-shrink, flex-basis\", \"align-items, align-content, order\", \"display, gap, align-self\"], \"correct_option_index\": 1}',NULL,NULL,1.00,1,NULL,1,'2025-11-14 19:42:17','2025-11-14 19:42:33',60,0,NULL),(26,10,'single_choice','Semantic HTML means:','{\"options\": [\"Using only <div> elements for everything\", \"Using comments to explain code\", \"Choosing tags that convey meaning (e.g., <nav>, <header>, <article>)\", \"Embedding CSS directly in HTML\"], \"correct_option_index\": 2}',NULL,NULL,1.00,3,NULL,1,'2025-11-14 19:43:39','2025-11-14 19:43:39',60,0,NULL),(27,10,'true_false','alt attributes are required for accessibility.','{\"correct_answer\": true}',NULL,NULL,1.00,4,NULL,1,'2025-11-14 19:44:19','2025-11-14 19:44:19',60,0,NULL),(28,10,'true_false','Color alone is acceptable to convey important information.','{\"correct_answer\": false}',NULL,NULL,1.00,5,NULL,1,'2025-11-14 19:45:04','2025-11-14 19:45:04',60,0,NULL),(30,10,'coding','Responsive Header HTML/CSS','{\"language\": \"html\", \"test_cases\": [{\"id\": \"1\", \"input\": \"valid-structure\", \"points\": 20, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"HTML validation passed\"}, {\"id\": \"2\", \"input\": \"contains:h1\", \"points\": 20, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"HTML validation passed\"}, {\"id\": \"3\", \"input\": \"semantic-html\", \"points\": 10, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"HTML validation passed\"}], \"constraints\": \"1. HTML Structure Constraints\\n\\nMust use semantic elements:\\n\\n<header>\\n\\n<nav>\\n\\n<a> for all navigation links\\n\\nMust NOT use <div> alone for overall layout unless necessary.\\n\\nMust include at least 3 navigation links inside the nav element.\\n\\nA logo must be included using <a> with class \\\"logo\\\".\\n\\nMust include two buttons:\\n\\nSearch button\\n\\nMenu (hamburger) button\\n\\nMenu button must include:\\n\\naria-expanded\\n\\naria-controls=\\\"nav\\\"\\n\\n2. CSS Constraints\\n\\nHeader layout must use Flexbox, not Grid or floats.\\n\\nMust include a media query, specifically targeting maximum width:\\n\\n@media (max-width: 700px)\\n\\n\\nOn desktop screens (width ≥ 701px):\\n\\nNavigation must be visible\\n\\nMenu button must be hidden\\n\\nOn mobile screens (≤ 700px):\\n\\nNavigation must be hidden\\n\\nMenu button must become visible\\n\\nMust NOT use inline CSS.\\n\\nMust NOT use frameworks like Bootstrap or Tailwind—pure CSS only.\\n\\n3. Accessibility Constraints\\n\\nSearch button must have:\\n\\naria-label=\\\"Search\\\"\\n\\n\\nMenu button must correctly toggle:\\n\\naria-expanded=\\\"false\\\" initially\\n\\nNavigation must be linked to menu button using:\\n\\naria-controls=\\\"nav\\\"\\n\\n\\nAll interactive elements must be reachable via keyboard (no display: none for buttons).\\n\\nColor contrast between the background and text must meet at least WCAG AA (4.5:1).\\n\\n4. Responsive Behavior Constraints\\n\\nLayout must not break when screen shrinks or expands.\\n\\nNav links must wrap or hide properly (no overflow outside the header).\\n\\nHeader height must remain consistent on all screen sizes.\\n\\nAll images (if included) must scale with max-width: 100%.\\n\\n5. Code Quality Constraints\\n\\nHTML must be properly indented and readable.\\n\\nCSS must not include unused classes.\\n\\nComments must be used to explain major sections (optional but encouraged).\\n\\nNo duplicated code blocks.\\n\\nCode must pass W3C HTML and CSS Validation.\", \"starter_code\": \"<!DOCTYPE html>\\n<html lang=\\\"en\\\">\\n<head>\\n    <meta charset=\\\"UTF-8\\\">\\n    <meta name=\\\"viewport\\\" content=\\\"width=device-width, initial-scale=1.0\\\">\\n    <title>My Page</title>\\n</head>\\n<body>\\n    <!-- Your content here -->\\n</body>\\n</html>\"}',NULL,'Answer correctly',10.00,6,NULL,1,'2025-11-14 21:24:53','2025-11-14 22:00:05',60,1,NULL),(31,10,'coding','Implement a function to calculate sum of two numbers','{\"language\": \"javascript\", \"test_cases\": [{\"id\": \"1763225059754\", \"input\": \"twoSum([2,7,11,15], 9)\", \"points\": 10, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"[0,1]\"}], \"starter_code\": \"function twoSum(nums, target) {\\n  // Your solution here\\n}\"}',NULL,NULL,1.00,7,NULL,1,'2025-11-15 16:29:49','2025-11-15 16:45:36',60,1,NULL);
/*!40000 ALTER TABLE `quiz_questions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `quiz_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quiz_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quiz_id` int NOT NULL,
  `student_id` int NOT NULL,
  `total_score` decimal(8,2) NOT NULL,
  `max_score` decimal(8,2) NOT NULL,
  `percentage` decimal(5,2) NOT NULL,
  `status` enum('in_progress','completed','timed_out','abandoned') NOT NULL DEFAULT 'in_progress',
  `grade_status` enum('pending','graded','auto_graded') NOT NULL DEFAULT 'pending',
  `time_taken` int NOT NULL,
  `started_at` datetime NOT NULL,
  `completed_at` datetime DEFAULT NULL,
  `graded_at` datetime DEFAULT NULL,
  `graded_by` int DEFAULT NULL,
  `feedback` text,
  `passed` tinyint(1) NOT NULL,
  `attempt_number` int NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL COMMENT 'Calculated end time based on quiz duration',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_student_quiz_attempt` (`student_id`,`quiz_id`,`attempt_number`),
  KEY `quiz_id` (`quiz_id`),
  KEY `graded_by` (`graded_by`),
  KEY `idx_quiz_submissions_student_quiz_status` (`student_id`,`quiz_id`,`status`),
  CONSTRAINT `quiz_submissions_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `quiz_submissions_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `quiz_submissions_ibfk_3` FOREIGN KEY (`graded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `quiz_submissions` WRITE;
/*!40000 ALTER TABLE `quiz_submissions` DISABLE KEYS */;
INSERT INTO `quiz_submissions` VALUES (1,6,3,0.00,20.00,0.00,'completed','auto_graded',8627,'2025-10-27 16:38:08','2025-10-28 15:43:50',NULL,NULL,NULL,0,1,'2025-10-27 16:38:08','2025-10-28 15:43:50',NULL),(2,3,3,10.00,10.00,100.00,'completed','auto_graded',91359,'2025-11-03 22:11:35','2025-11-04 08:21:41',NULL,NULL,NULL,1,1,'2025-11-03 22:11:35','2025-11-04 08:21:41',NULL),(3,4,3,0.00,20.00,0.00,'completed','auto_graded',371581,'2025-11-04 11:57:17','2025-11-05 18:42:21',NULL,NULL,NULL,0,1,'2025-11-04 11:57:17','2025-11-05 18:42:22',NULL),(4,7,3,0.00,50.00,0.00,'completed','auto_graded',65687,'2025-11-04 13:30:54','2025-11-05 19:04:09',NULL,NULL,NULL,0,1,'2025-11-04 13:30:54','2025-11-05 19:04:09',NULL),(5,8,3,0.00,0.00,0.00,'completed','auto_graded',928283,'2025-11-04 13:32:23','2025-11-05 14:52:53',NULL,NULL,NULL,0,1,'2025-11-04 13:32:23','2025-11-05 14:52:53',NULL),(6,3,3,0.00,0.00,0.00,'timed_out','pending',0,'2025-11-05 19:02:28','2025-11-06 12:40:30',NULL,NULL,NULL,0,2,'2025-11-05 19:02:28','2025-11-06 12:40:30','2025-11-05 19:32:28'),(7,5,3,0.00,50.00,0.00,'completed','auto_graded',14746,'2025-11-05 21:32:12','2025-11-05 21:32:27',NULL,NULL,NULL,0,1,'2025-11-05 21:32:12','2025-11-05 21:32:27','2025-11-05 22:17:12'),(8,5,3,0.00,0.00,0.00,'in_progress','pending',0,'2025-11-06 12:40:39',NULL,NULL,NULL,NULL,0,2,'2025-11-06 12:40:39','2025-11-06 12:40:39','2025-11-06 13:25:39'),(9,9,3,0.00,0.00,0.00,'completed','auto_graded',325806,'2025-11-07 23:39:42','2025-11-11 15:14:09',NULL,NULL,NULL,0,1,'2025-11-07 23:39:42','2025-11-11 15:14:09',NULL),(10,10,3,0.00,16.00,0.00,'completed','auto_graded',143119,'2025-11-15 16:51:18','2025-11-15 16:57:01',NULL,NULL,NULL,0,1,'2025-11-15 16:51:18','2025-11-15 16:57:01',NULL),(11,10,4,0.00,5.00,0.00,'completed','pending',162919,'2025-11-22 09:55:55','2025-11-24 15:28:43',NULL,NULL,NULL,0,1,'2025-11-22 09:55:55','2025-11-24 15:28:43',NULL);
/*!40000 ALTER TABLE `quiz_submissions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `quizzes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quizzes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `instructions` text,
  `status` enum('draft','in_progress','published','completed') NOT NULL DEFAULT 'draft',
  `type` enum('Assessment','Homework','Quiz','Exam') NOT NULL DEFAULT 'Quiz',
  `time_limit` int DEFAULT NULL,
  `max_attempts` int DEFAULT NULL,
  `passing_score` decimal(5,2) DEFAULT NULL,
  `show_results_immediately` tinyint(1) NOT NULL DEFAULT '1',
  `randomize_questions` tinyint(1) NOT NULL DEFAULT '0',
  `show_correct_answers` tinyint(1) NOT NULL DEFAULT '0',
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `course_id` int DEFAULT NULL,
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `enable_automatic_grading` tinyint(1) NOT NULL DEFAULT '1',
  `require_manual_grading` tinyint(1) NOT NULL DEFAULT '0',
  `attachments` text,
  PRIMARY KEY (`id`),
  KEY `course_id` (`course_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_quizzes_is_public` (`is_public`),
  KEY `idx_quizzes_status_public` (`status`,`is_public`),
  CONSTRAINT `quizzes_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `quizzes` WRITE;
/*!40000 ALTER TABLE `quizzes` DISABLE KEYS */;
INSERT INTO `quizzes` VALUES (1,'This is Mathematics','This is Mathematics desc','This is Mathematics','draft','Quiz',20,9,60.00,1,0,1,1,NULL,NULL,2,1,'2025-10-25 16:20:36','2025-10-26 09:36:38',0,1,NULL),(2,'This is testing','This is the question description details','This is the instruction','draft','Quiz',50,9,60.00,1,1,1,1,'2025-10-27 17:09:54','2025-10-29 00:00:00',2,1,'2025-10-27 15:04:52','2025-10-27 15:08:39',0,1,NULL),(3,'1. JavaScript Fundamentals Quiz','Test your knowledge of JavaScript basics including variables, functions, and data types.','','published','Quiz',30,3,70.00,1,0,1,1,'2025-01-01 00:00:00','2025-12-31 23:59:59',1,1,'2025-10-27 17:22:11','2025-11-03 22:11:12',0,1,NULL),(4,'JavaScript Fundamentals Quiz','Test your knowledge of JavaScript basics including variables, functions, and data types.',NULL,'published','Quiz',30,3,70.00,1,0,1,1,'2025-01-01 00:00:00','2025-12-31 23:59:59',1,1,'2025-10-27 17:22:47','2025-10-27 17:22:47',0,1,NULL),(5,'Web Development Basics','Test your understanding of web development fundamentals covered in the course.',NULL,'published','Assessment',45,2,60.00,0,1,1,0,'2025-10-01 00:00:00','2025-11-30 23:59:59',2,2,'2025-10-27 17:22:47','2025-10-27 17:22:47',0,1,NULL),(6,'JavaScript Fundamentals Quiz','Test your knowledge of JavaScript basics including variables, functions, and data types.',NULL,'published','Quiz',30,3,70.00,1,0,1,1,'2025-01-01 00:00:00','2025-12-31 23:59:59',1,1,'2025-10-27 17:29:57','2025-11-07 23:06:39',0,1,NULL),(7,'Web Development Basics','Test your understanding of web development fundamentals covered in the course.',NULL,'published','Assessment',45,2,60.00,0,1,1,0,'2025-10-01 00:00:00','2025-11-30 23:59:59',2,2,'2025-10-27 17:29:57','2025-10-27 17:29:57',0,1,NULL),(8,'Javascript Quiz for Testing','This is the description','','published','Quiz',8,1,50.00,1,0,1,1,NULL,NULL,1,1,'2025-11-04 13:28:08','2025-11-04 13:31:39',0,1,NULL),(9,'TypeScript Test','This is the typsecript test, make sure you answer all questions','','published','Quiz',NULL,1,50.00,1,0,0,1,NULL,NULL,1,1,'2025-11-07 18:48:14','2025-11-07 18:53:04',0,1,NULL),(10,'Web Design Quiz — Fundamentals & Practical','This quiz assesses your understanding of web design principles, including visual design, responsive layout techniques, accessibility standards, performance optimization, user interface (UI) concepts, and best practices for modern front-end development.','Instructions: Answer all questions. Multiple-choice/true-false = choose the best answer. For short answers be concise. For practical tasks, show code or describe expected behavior. Good luck!','published','Quiz',NULL,5,NULL,1,0,0,1,NULL,NULL,1,1,'2025-11-14 18:26:29','2025-11-15 16:51:03',0,1,NULL);
/*!40000 ALTER TABLE `quizzes` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `report_card_assessments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_card_assessments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `report_card_id` int NOT NULL,
  `subject_id` int NOT NULL,
  `assessment_type` enum('quiz','assignment','manual') COLLATE utf8mb4_unicode_ci NOT NULL,
  `assessment_id` int NOT NULL,
  `category` enum('CW','HW','MD','EOT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `report_card_assessments_report_card_id` (`report_card_id`),
  KEY `report_card_assessments_subject_id` (`subject_id`),
  KEY `report_card_assessments_assessment_type_assessment_id` (`assessment_type`,`assessment_id`),
  CONSTRAINT `report_card_assessments_ibfk_1` FOREIGN KEY (`report_card_id`) REFERENCES `report_cards` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `report_card_assessments` WRITE;
/*!40000 ALTER TABLE `report_card_assessments` DISABLE KEYS */;
/*!40000 ALTER TABLE `report_card_assessments` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `report_card_attributes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_card_attributes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `report_card_id` int NOT NULL,
  `attribute_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rating` enum('Excellent','Very good','Good') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `report_card_attributes_report_card_id` (`report_card_id`),
  CONSTRAINT `report_card_attributes_ibfk_1` FOREIGN KEY (`report_card_id`) REFERENCES `report_cards` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `report_card_attributes` WRITE;
/*!40000 ALTER TABLE `report_card_attributes` DISABLE KEYS */;
/*!40000 ALTER TABLE `report_card_attributes` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `report_cards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `pdf_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_id` int NOT NULL,
  `term` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `academic_year` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('draft','saved','approved') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `class_teacher_comment` text COLLATE utf8mb4_unicode_ci,
  `attendance_present` int NOT NULL DEFAULT '0',
  `attendance_absent` int NOT NULL DEFAULT '0',
  `attendance_late` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  KEY `report_cards_student_id` (`student_id`),
  KEY `report_cards_academic_year_term` (`academic_year`,`term`),
  CONSTRAINT `report_cards_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `report_cards` WRITE;
/*!40000 ALTER TABLE `report_cards` DISABLE KEYS */;
/*!40000 ALTER TABLE `report_cards` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_permissions_permission_id_role_id_unique` (`role_id`,`permission_id`),
  UNIQUE KEY `role_permissions_role_id_permission_id_unique` (`role_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=130 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,1,1,'2026-09-17 19:00:24'),(2,1,2,'2026-09-17 19:00:24'),(3,1,3,'2026-09-17 19:00:24'),(4,1,4,'2026-09-17 19:00:24'),(5,1,5,'2026-09-17 19:00:24'),(6,1,6,'2026-09-17 19:00:24'),(7,1,7,'2026-09-17 19:00:24'),(8,1,8,'2026-09-17 19:00:24'),(9,1,9,'2026-09-17 19:00:24'),(10,1,10,'2026-09-17 19:00:24'),(11,1,11,'2026-09-17 19:00:24'),(12,1,12,'2026-09-17 19:00:24'),(13,1,13,'2026-09-17 19:00:24'),(14,1,14,'2026-09-17 19:00:24'),(15,1,15,'2026-09-17 19:00:24'),(16,1,16,'2026-09-17 19:00:24'),(17,1,17,'2026-09-17 19:00:24'),(18,1,18,'2026-09-17 19:00:24'),(19,1,19,'2026-09-17 19:00:24'),(20,1,20,'2026-09-17 19:00:24'),(21,1,21,'2026-09-17 19:00:24'),(22,1,22,'2026-09-17 19:00:24'),(23,1,23,'2026-09-17 19:00:24'),(24,1,24,'2026-09-17 19:00:24'),(25,1,25,'2026-09-17 19:00:24'),(26,1,26,'2026-09-17 19:00:24'),(27,1,27,'2026-09-17 19:00:24'),(28,1,28,'2026-09-17 19:00:24'),(29,1,29,'2026-09-17 19:00:24'),(30,1,30,'2026-09-17 19:00:24'),(31,1,31,'2026-09-17 19:00:24'),(32,1,32,'2026-09-17 19:00:24'),(33,1,33,'2026-09-17 19:00:24'),(34,1,34,'2026-09-17 19:00:24'),(35,1,35,'2026-09-17 19:00:24'),(36,1,36,'2026-09-17 19:00:24'),(37,1,37,'2026-09-17 19:00:24'),(38,1,38,'2026-09-17 19:00:24'),(39,1,39,'2026-09-17 19:00:24'),(40,1,40,'2026-09-17 19:00:24'),(41,1,41,'2026-09-17 19:00:24'),(42,1,42,'2026-09-17 19:00:24'),(43,1,43,'2026-09-17 19:00:24'),(44,1,44,'2026-09-17 19:00:24'),(45,1,45,'2026-09-17 19:00:24'),(46,1,46,'2026-09-17 19:00:24'),(47,1,47,'2026-09-17 19:00:24'),(48,1,48,'2026-09-17 19:00:24'),(49,1,49,'2026-09-17 19:00:24'),(50,1,50,'2026-09-17 19:00:24'),(51,1,51,'2026-09-17 19:00:24'),(52,1,52,'2026-09-17 19:00:24'),(53,1,53,'2026-09-17 19:00:24'),(54,1,54,'2026-09-17 19:00:24'),(55,1,55,'2026-09-17 19:00:24'),(56,1,56,'2026-09-17 19:00:24'),(57,1,57,'2026-09-17 19:00:24'),(58,1,58,'2026-09-17 19:00:24'),(59,1,59,'2026-09-17 19:00:24'),(60,1,60,'2026-09-17 19:00:24'),(61,1,61,'2026-09-17 19:00:24'),(62,1,62,'2026-09-17 19:00:24'),(63,1,63,'2026-09-17 19:00:24'),(64,1,64,'2026-09-17 19:00:24'),(65,1,65,'2026-09-17 19:00:24'),(66,1,66,'2026-09-17 19:00:24'),(67,2,8,'2026-09-17 19:00:24'),(68,2,10,'2026-09-17 19:00:24'),(69,2,12,'2026-09-17 19:00:24'),(70,2,13,'2026-09-17 19:00:24'),(71,2,15,'2026-09-17 19:00:24'),(72,2,16,'2026-09-17 19:00:24'),(73,2,17,'2026-09-17 19:00:24'),(74,2,18,'2026-09-17 19:00:24'),(75,2,19,'2026-09-17 19:00:24'),(76,2,22,'2026-09-17 19:00:24'),(77,2,24,'2026-09-17 19:00:24'),(78,2,25,'2026-09-17 19:00:24'),(79,2,26,'2026-09-17 19:00:24'),(80,2,27,'2026-09-17 19:00:24'),(81,2,28,'2026-09-17 19:00:24'),(82,2,31,'2026-09-17 19:00:24'),(83,2,32,'2026-09-17 19:00:24'),(84,2,33,'2026-09-17 19:00:24'),(85,2,34,'2026-09-17 19:00:24'),(86,2,35,'2026-09-17 19:00:24'),(87,2,36,'2026-09-17 19:00:24'),(88,2,37,'2026-09-17 19:00:24'),(89,2,38,'2026-09-17 19:00:24'),(90,2,39,'2026-09-17 19:00:24'),(91,2,40,'2026-09-17 19:00:24'),(92,2,41,'2026-09-17 19:00:24'),(93,2,42,'2026-09-17 19:00:24'),(94,2,44,'2026-09-17 19:00:24'),(95,2,46,'2026-09-17 19:00:24'),(96,2,47,'2026-09-17 19:00:24'),(97,2,50,'2026-09-17 19:00:24'),(98,2,51,'2026-09-17 19:00:24'),(99,2,52,'2026-09-17 19:00:24'),(100,2,54,'2026-09-17 19:00:24'),(101,2,55,'2026-09-17 19:00:24'),(102,2,56,'2026-09-17 19:00:24'),(103,2,57,'2026-09-17 19:00:24'),(104,2,58,'2026-09-17 19:00:24'),(105,2,60,'2026-09-17 19:00:24'),(106,2,62,'2026-09-17 19:00:24'),(107,2,2,'2026-09-17 19:00:24'),(108,2,7,'2026-09-17 19:00:24'),(109,2,6,'2026-09-17 19:00:24'),(110,3,1,'2026-09-17 19:00:24'),(111,3,8,'2026-09-17 19:00:24'),(112,3,14,'2026-09-17 19:00:24'),(113,3,15,'2026-09-17 19:00:24'),(114,3,21,'2026-09-17 19:00:24'),(115,3,23,'2026-09-17 19:00:24'),(116,3,25,'2026-09-17 19:00:24'),(117,3,29,'2026-09-17 19:00:24'),(118,3,30,'2026-09-17 19:00:24'),(119,3,34,'2026-09-17 19:00:24'),(120,3,35,'2026-09-17 19:00:24'),(121,3,43,'2026-09-17 19:00:24'),(122,3,45,'2026-09-17 19:00:24'),(123,3,48,'2026-09-17 19:00:24'),(124,3,49,'2026-09-17 19:00:24'),(125,3,54,'2026-09-17 19:00:24'),(126,3,61,'2026-09-17 19:00:24'),(127,3,62,'2026-09-17 19:00:24'),(128,1,68,'2026-09-17 19:00:25'),(129,1,67,'2026-09-17 19:00:25');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin','Full access to all system features',1,'2026-09-17 19:00:24','2026-09-17 19:00:24'),(2,'instructor','Manages courses, assignments, quizzes, and grading',1,'2026-09-17 19:00:24','2026-09-17 19:00:24'),(3,'student','Attempts quizzes/assignments and views own results',1,'2026-09-17 19:00:24','2026-09-17 19:00:24');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `subject_assessment_mappings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subject_assessment_mappings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `subject_id` int NOT NULL,
  `term` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `academic_year` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assessment_type` enum('quiz','assignment','manual') COLLATE utf8mb4_unicode_ci NOT NULL,
  `assessment_id` int NOT NULL,
  `category` enum('CW','HW','MD','EOT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subject_assessment_mappings_unique_assessment` (`subject_id`,`term`,`academic_year`,`assessment_type`,`assessment_id`),
  KEY `subject_assessment_mappings_subject_id_term_academic_year` (`subject_id`,`term`,`academic_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `subject_assessment_mappings` WRITE;
/*!40000 ALTER TABLE `subject_assessment_mappings` DISABLE KEYS */;
/*!40000 ALTER TABLE `subject_assessment_mappings` ENABLE KEYS */;
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
  `file_submissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `grade` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `feedback` text,
  `resubmissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `is_late` tinyint(1) NOT NULL DEFAULT '0',
  `comments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `submitted_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_assignment_student` (`assignment_id`,`student_id`),
  KEY `submissions_student_id` (`student_id`),
  KEY `submissions_assignment_id` (`assignment_id`),
  KEY `submissions_status` (`status`),
  KEY `submissions_submitted_at` (`submitted_at`),
  KEY `submissions_submitted_by_foreign_idx` (`submitted_by`),
  CONSTRAINT `submissions_ibfk_115` FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `submissions_ibfk_116` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `submissions_submitted_by_foreign_idx` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `submissions` WRITE;
/*!40000 ALTER TABLE `submissions` DISABLE KEYS */;
INSERT INTO `submissions` VALUES (1,1,3,'graded','2025-10-21 17:37:17','This is the submission','[{\"filename\":\"Archive (2).zip\",\"originalname\":\"Archive (2).zip\",\"path\":\"/Users/m2pro/dev/projects/AI PROJECTS/NGA-Projects/spwms/server/uploads/file_submission-1761068237753-891925332.zip\",\"size\":146284,\"mimetype\":\"application/zip\"}]','80/100','ok','[]',0,'[]','2025-10-21 17:37:17','2025-10-23 14:30:29',NULL);
/*!40000 ALTER TABLE `submissions` ENABLE KEYS */;
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
  `mis_user_id` int DEFAULT NULL COMMENT 'MIS system user ID',
  `role_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `mis_user_id` (`mis_user_id`),
  KEY `idx_users_mis_user_id` (`mis_user_id`),
  KEY `users_role_id` (`role_id`),
  CONSTRAINT `users_role_id_foreign_idx` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Niyongabo','Emmanuel','emmanuelniyongabo44@gmail.com','$2a$10$K3QdagXt7nkZFEnSNET8x.rciv8mgedl8xPbVHv5RXGwKORje.0r.','admin','profile-1-1763144624263-328190628.png',NULL,NULL,'2025-10-20 11:14:00','2026-09-17 19:01:00',1,1),(2,'ISHIMWE','Keny kelvin','ikennykelvin75@gmail.com','$2a$10$2nohspCj/oqTN9.4fS28Mu21bkbb57qtAudArO/v1.hMN/91WXhk.','student',NULL,NULL,NULL,'2025-10-20 11:55:50','2025-10-20 11:55:50',NULL,3),(3,'Doe','John','johndoe@gmail.com','$2a$10$Hdr15vHryzSDm8nIkRvXZeG18AxGCHAIM3CW8lE7AaNhx1vFewmRq','student','profile-3-1761291718198-707527274.png',NULL,NULL,'2025-10-20 13:54:42','2025-10-24 07:41:58',NULL,3),(4,'HIRWA','Brian','bhirwa344@gmail.com','$2a$10$Hdr15vHryzSDm8nIkRvXZeG18AxGCHAIM3CW8lE7AaNhx1vFewmRq','student',NULL,NULL,NULL,'2025-10-20 14:17:50','2025-10-20 14:17:50',NULL,3),(5,'Tuyishimire','Eric','tuyishimireericc@gmail.com','$2a$10$d4KUZxO96S4OZzCpmlhfveH8gHUopm/6um5MEEFfZWLExOoTmqRdi','instructor',NULL,NULL,NULL,'2025-10-20 14:28:30','2025-10-20 14:28:30',NULL,2),(6,'Utuje Oceanne','Camilla','utujeocean@gmail.com','$2a$10$ZIIFeIkOn5c/NPOtnPlbk.bw9BghNX55Ld/nBaPdtg41jseOOfp6S','student',NULL,NULL,NULL,'2025-10-20 17:26:20','2025-10-20 17:26:20',NULL,3),(7,'Levi','Gatimu','getmorelev@gmail.com','$2a$10$1aNshK8NJLE7QOneHcJMC.RcXXYAWC0T.2plQrglCj.DV7osSZPaG','student',NULL,NULL,NULL,'2025-10-20 18:25:38','2025-10-20 18:25:38',NULL,3),(8,'TUNGA','Tiana','tianatunga@gmail.com','$2a$10$czm6/VJEB0JnL7JzTZTBPu6ADQQMKBDIKRb6SjO9jqN65X8BjvRRK','student',NULL,NULL,NULL,'2025-10-21 05:33:34','2025-10-21 05:33:34',NULL,3),(9,'Isaro','Deborah','isarodeborah85@gmail.com','$2a$10$fpUFmCJTqCGtHTdmkN4TzO7x5f4PeKtOm6PJLjqtRrdiOLbX0J75.','student',NULL,NULL,NULL,'2025-10-21 05:43:33','2025-10-21 05:43:33',NULL,3),(10,'Kheilla','Vera','cyusagisa12@gmail.com','$2a$10$gyBrrzWwnPSyBj.i35BcTeRfg7nsk3WHGbBPDVg2KHoY8lllM3qWK','student',NULL,NULL,NULL,'2025-10-21 05:44:48','2025-10-21 05:44:48',NULL,3),(11,'Test','Instructor','instructor@example.com','$2a$10$l3pMbByOpjy4xQ2IqQ6V0ejPxOArb1bstyTgFYfczRIodZ8lZB962','instructor',NULL,NULL,NULL,'2025-11-07 20:17:59','2025-11-07 20:17:59',NULL,2);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!50001 DROP VIEW IF EXISTS `question_difficulty`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `question_difficulty` AS select `qq`.`id` AS `question_id`,`qq`.`quiz_id` AS `quiz_id`,`qq`.`question_type` AS `question_type`,`qq`.`points` AS `points`,count(`qa`.`id`) AS `total_attempts`,count((case when (`qa`.`is_correct` = 1) then 1 end)) AS `correct_attempts`,(case when (count(`qa`.`id`) > 0) then ((count((case when (`qa`.`is_correct` = 1) then 1 end)) / count(`qa`.`id`)) * 100) else 0 end) AS `success_rate`,avg(`qa`.`points_earned`) AS `average_points_earned`,avg(`qa`.`time_taken`) AS `average_time_seconds` from (`quiz_questions` `qq` left join `quiz_attempts` `qa` on((`qq`.`id` = `qa`.`question_id`))) group by `qq`.`id`,`qq`.`quiz_id`,`qq`.`question_type`,`qq`.`points` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `quiz_analytics`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `quiz_analytics` AS select `q`.`id` AS `quiz_id`,`q`.`title` AS `title`,`q`.`course_id` AS `course_id`,count(`qs`.`id`) AS `total_submissions`,avg(`qs`.`percentage`) AS `average_score`,avg((`qs`.`time_taken` / 60)) AS `average_time_minutes`,((sum((case when `qs`.`passed` then 1 else 0 end)) / count(`qs`.`id`)) * 100) AS `pass_rate`,count((case when (`qs`.`status` = 'completed') then 1 end)) AS `completed_submissions`,count((case when (`qs`.`grade_status` = 'graded') then 1 end)) AS `graded_submissions` from (`quizzes` `q` left join `quiz_submissions` `qs` on((`q`.`id` = `qs`.`quiz_id`))) group by `q`.`id`,`q`.`title`,`q`.`course_id` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


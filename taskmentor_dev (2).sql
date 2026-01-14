-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost:8889
-- Generation Time: Nov 25, 2025 at 09:58 PM
-- Server version: 5.7.39-log
-- PHP Version: 8.2.0

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `taskmentor_dev`
--

-- --------------------------------------------------------

--
-- Table structure for table `assignments`
--

CREATE TABLE `assignments` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `due_date` datetime NOT NULL,
  `max_score` int(11) NOT NULL,
  `submission_type` enum('file','text','both') NOT NULL DEFAULT 'both',
  `allowed_file_types` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `rubric` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `course_id` int(11) NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `status` enum('draft','published','completed','removed') NOT NULL DEFAULT 'draft',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `assignments`
--

INSERT INTO `assignments` (`id`, `title`, `description`, `due_date`, `max_score`, `submission_type`, `allowed_file_types`, `rubric`, `course_id`, `created_by`, `status`, `created_at`, `updated_at`) VALUES
(1, 'Create a personal portfolio website', '<h3><font size=\"5\" color=\"#000000\"><b>Activity</b></font></h3><p data-start=\"112\" data-end=\"262\"><font color=\"#000000\">Create a&nbsp;<span data-start=\"121\" data-end=\"151\">personal portfolio website</span>&nbsp;that showcases your skills, projects, and contact information using&nbsp;<span data-start=\"220\" data-end=\"259\">HTML, CSS, and basic web interfaces</span>.</font></p><p data-start=\"112\" data-end=\"262\"><font color=\"#000000\"><br></font></p><p data-start=\"264\" data-end=\"380\"><font color=\"#000000\">After completing your design,&nbsp;<span data-start=\"294\" data-end=\"339\"><u>compress (zip)</u> your entire project folder</span>&nbsp;and submit it&nbsp;<span data-start=\"354\" data-end=\"377\">before the deadline.</span></font></p><p><font color=\"#000000\"><br></font></p><h3><font size=\"5\" color=\"#000000\"><b>Task Description</b></font></h3><p><font color=\"#000000\">You are required to&nbsp;<strong>design and develop</strong>&nbsp;a personal portfolio webpage that includes the following interfaces and design elements:</font></p><p><font color=\"#000000\"><br></font></p><h4><font color=\"#000000\">1.&nbsp;<strong>Homepage (Introduction Section)</strong></font></h4><ul><li><p><font color=\"#000000\">Include your name, photo, and a short bio or personal statement.</font></p></li><li><p><font color=\"#000000\">Add navigation links to other sections (About, Projects, Contact).</font></p></li><li><p><font color=\"#000000\"><br></font></p></li></ul><h4><font color=\"#000000\">2.&nbsp;<strong>About Me page</strong></font></h4><ul><li><p><font color=\"#000000\">Write a brief description about yourself (education, goals, skills).</font></p></li><li><p><font color=\"#000000\">Use&nbsp;<strong>CSS styling</strong>&nbsp;to organize content clearly and attractively.</font></p></li></ul><h4><font color=\"#000000\"><br></font></h4><h4><font color=\"#000000\">3.&nbsp;<strong>Projects page</strong></font></h4><ul><li><p><font color=\"#000000\">Display at least&nbsp;<strong>three projects</strong>&nbsp;you have done (real or sample).</font></p></li><li><p><font color=\"#000000\">Use a&nbsp;<strong>table</strong>&nbsp;to organize project names, descriptions, and technologies used.</font></p></li><li><p><font color=\"#000000\"><br></font></p></li></ul><h4><font color=\"#000000\">4.&nbsp;<strong>Contact page</strong></font></h4><ul><li><p><font color=\"#000000\">Create a&nbsp;<strong>contact form page</strong>&nbsp;with the following fields:</font></p><ul><li><p><font color=\"#000000\">Full Name</font></p></li><li><p><font color=\"#000000\">Email Address</font></p></li><li><p><font color=\"#000000\">Message</font></p></li><li><p><font color=\"#000000\">Submit Button</font></p></li></ul></li><li></li><li><p><font color=\"#000000\"><br></font></p></li></ul><h4><font color=\"#000000\">5.&nbsp;<strong>Page Footer</strong></font></h4><ul><li><p><font color=\"#000000\">Add copyright information and social media links.</font></p></li><li><p><font color=\"#000000\"><br></font></p></li></ul><h3><font size=\"5\" color=\"#000000\"><b>Interfaces to Implement</b></font></h3><p><font color=\"#000000\">Make sure to include these&nbsp;<strong>HTML interfaces</strong>&nbsp;in your design:</font></p><table><thead><tr><th><font color=\"#000000\">Interface</font></th><th><font color=\"#000000\">Description</font></th><th><font color=\"#000000\">Example</font></th></tr></thead><tbody><tr><td><code inline=\"\"><font color=\"#000000\">&lt;div&gt;</font></code></td><td><font color=\"#000000\">Generic container for grouping elements&nbsp;</font></td><td><code inline=\"\"><font color=\"#000000\">&lt;div class=\"container\"&gt;&lt;/div&gt;</font></code></td></tr><tr><td><code inline=\"\"><font color=\"#000000\">&lt;section&gt;&nbsp;</font></code></td><td><font color=\"#000000\">Defines thematic grouping of content</font></td><td><code inline=\"\"><font color=\"#000000\">&lt;section id=\"about\"&gt;&lt;/section&gt;</font></code></td></tr><tr><td><code inline=\"\"><font color=\"#000000\">&lt;article&gt;</font></code></td><td><font color=\"#000000\">Independent content unit</font></td><td><code inline=\"\"><font color=\"#000000\">&lt;article&gt;&lt;h3&gt;My Project&lt;/h3&gt;&lt;/article&gt;</font></code></td></tr><tr><td><code inline=\"\"><font color=\"#000000\">&lt;table&gt;</font></code></td><td><font color=\"#000000\">Displays tabular data</font></td><td><code inline=\"\"><font color=\"#000000\">&lt;table&gt;&lt;tr&gt;&lt;td&gt;Project 1&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;</font></code></td></tr><tr><td><code inline=\"\"><font color=\"#000000\">&lt;form&gt;</font></code></td><td><font color=\"#000000\">Collects user input</font></td><td><code inline=\"\"><font color=\"#000000\">&lt;form&gt;&lt;input type=\"text\" name=\"name\"&gt;&lt;/form&gt;</font></code></td></tr></tbody></table><h3><font color=\"#000000\"><br></font></h3><h3><b><font color=\"#000000\">Design Requirements</font></b></h3><ul><li><p><font color=\"#000000\">Apply&nbsp;<strong>CSS styling</strong>&nbsp;(colors, margins, fonts, hover effects).</font></p></li><li><p><font color=\"#000000\">Use a&nbsp;<strong>consistent color theme and layout</strong>&nbsp;across all sections.</font></p></li><li><p><font color=\"#000000\">Ensure your site is&nbsp;<strong>responsive</strong>&nbsp;on both desktop and mobile devices.</font></p></li><li><p><font color=\"#000000\">Include&nbsp;<strong>comments</strong>&nbsp;in your code to describe main parts.</font></p></li></ul><h3><font color=\"#000000\"><br></font></h3><div><h3><font size=\"5\" color=\"#000000\"><b>Output Examples</b></font></h3></div><p><font color=\"#000000\">Your portfolio page should include:</font></p><ul><li><p><font color=\"#000000\">Navigation bar</font></p></li><li><p><font color=\"#000000\">Profile image</font></p></li><li><p><font color=\"#000000\">Sections (About, Projects, Contact)</font></p></li><li><p><font color=\"#000000\">Styled table for project listing</font></p></li><li><p><font color=\"#000000\">Functional contact form</font></p></li></ul><div><b id=\"docs-internal-guid-379a72b6-7fff-5b63-a8f1-fca4d9d6ac75\"><font color=\"#000000\"><br></font></b></div>', '2025-10-22 22:33:00', 100, 'both', NULL, NULL, 1, 1, 'completed', '2025-10-20 13:12:22', '2025-10-24 14:35:42'),
(2, 'Implement Web Components (Table & Form)', '<h3 data-start=\"1540\" data-end=\"1552\"><p data-start=\"397\" data-end=\"657\"><font color=\"#000000\"><strong data-start=\"397\" data-end=\"411\">Objective:</strong><br data-start=\"411\" data-end=\"414\">\nDesign and implement <strong data-start=\"435\" data-end=\"457\">two web components</strong> — a table and a form — that follow the given descriptions. Apply proper layout, colors, spacing, and alignment to make the components visually appealing and consistent with a styled webpage.</font></p>\n</h3><h3 data-start=\"664\" data-end=\"684\"><strong data-start=\"668\" data-end=\"684\"><font color=\"#000000\"><br></font></strong></h3><h3 data-start=\"664\" data-end=\"684\"><strong data-start=\"668\" data-end=\"684\"><font color=\"#000000\">Instructions</font></strong></h3><h3 data-start=\"1540\" data-end=\"1552\"><ol data-start=\"686\" data-end=\"1019\" style=\"list-style-type: lower-alpha; margin-left: 25px;\">\n<li data-start=\"782\" data-end=\"829\"><font color=\"#000000\"><span style=\"font-size: inherit; font-weight: inherit;\">Create a new&nbsp;</span><span data-start=\"702\" data-end=\"726\" style=\"font-size: inherit; font-weight: inherit;\">HTML and CSS project</span><span style=\"font-size: inherit; font-weight: inherit;\">.</span></font></li><li data-start=\"782\" data-end=\"829\"><font color=\"#000000\">Implement both components described below.</font></li><li data-start=\"782\" data-end=\"829\"><font color=\"#000000\">Use <span data-start=\"837\" data-end=\"862\" style=\"font-size: inherit; font-weight: inherit;\">CSS layout techniques</span><span style=\"font-size: inherit; font-weight: inherit;\"> such as </span><strong data-start=\"871\" data-end=\"882\" style=\"font-size: inherit;\">Flexbox</strong><span style=\"font-size: inherit; font-weight: inherit;\"> or </span><strong data-start=\"886\" data-end=\"894\" style=\"font-size: inherit;\">Grid</strong><span style=\"font-size: inherit; font-weight: inherit;\"> for alignment and spacing.</span></font></li><li data-start=\"782\" data-end=\"829\"><font color=\"#000000\">Ensure your design is <strong data-start=\"949\" data-end=\"984\" style=\"font-size: inherit;\">clean, readable, and consistent</strong><span style=\"font-size: inherit; font-weight: inherit;\"> in style (fonts, colors, margins).</span></font></li></ol><div><font color=\"#000000\"><br></font></div></h3><h3 data-start=\"1540\" data-end=\"1552\"><font color=\"#000000\"><b>Tip</b></font></h3>\n<p data-start=\"1553\" data-end=\"1576\"><font color=\"#000000\">Pay close attention to:</font></p>\n<ol style=\"list-style-type: lower-alpha; margin-left: 25px;\"><li><font color=\"#000000\">Alignment and spacing</font></li><li><font color=\"#000000\">Font styles and colors</font></li></ol><div><font color=\"#000000\"><br></font></div><div><h3 data-start=\"1026\" data-end=\"1067\"><strong data-start=\"1030\" data-end=\"1067\"><font color=\"#000000\">Component 1: Student Grades Table</font></strong></h3>\n<p data-start=\"1069\" data-end=\"1132\"><font color=\"#000000\">Create a table to display students and their grades as follows:</font></p></div><div><font color=\"#000000\"><b><br></b></font></div><div><span id=\"docs-internal-guid-8b4437bf-7fff-88ac-0fae-f3c80b20e54c\"><span id=\"docs-internal-guid-58e64771-7fff-ce41-1bb6-7cfd169a2414\" style=\"font-weight: bold;\"><span id=\"docs-internal-guid-0895260f-7fff-645a-a597-09d11924b1a3\" style=\"font-weight: bold;\"><span id=\"docs-internal-guid-ed9e2c27-7fff-2f54-408b-96ab8c0e7188\" style=\"font-weight: bold;\"><font color=\"#000000\" style=\"\"><div dir=\"ltr\" align=\"left\" style=\"\"><table><colgroup><col width=\"213\"><col width=\"203\"></colgroup><tbody><tr><td><p dir=\"ltr\"><span style=\"font-weight: normal;\">Grade</span></p></td><td><p dir=\"ltr\"><span style=\"font-weight: normal;\">Students</span></p></td></tr><tr><td rowspan=\"2\"><p dir=\"ltr\"><span style=\"font-weight: normal;\">G1</span></p></td><td><p dir=\"ltr\"><span style=\"font-weight: normal;\">TUNGA</span></p></td></tr><tr><td><p dir=\"ltr\"><span style=\"font-weight: normal;\">ISHIMWE</span></p></td></tr><tr><td rowspan=\"2\"><p dir=\"ltr\"><span style=\"font-weight: normal;\">G2</span></p></td><td><p dir=\"ltr\"><span style=\"font-weight: normal;\">Kenny</span></p></td></tr><tr><td><p dir=\"ltr\"><span style=\"font-weight: normal;\">Brian</span></p></td></tr><tr><td colspan=\"2\"><p dir=\"ltr\"><span style=\"font-weight: normal;\">Note: G1 - Grade 1, G2: Grade 2</span></p></td></tr></tbody></table></div><br></font></span></span></span></span></div><div><b><font color=\"#000000\"><br></font></b></div><div><h3 data-start=\"1417\" data-end=\"1463\"><strong data-start=\"1421\" data-end=\"1463\"><font color=\"#000000\">Component 2: Student Registration Form</font></strong></h3>\n<p data-start=\"1465\" data-end=\"1522\"><font color=\"#000000\">Design a form that allows entering basic student details.</font></p>\n<p data-start=\"1524\" data-end=\"1546\"><strong data-start=\"1524\" data-end=\"1546\"><font color=\"#000000\">Fields to include:</font></strong></p><p data-start=\"1524\" data-end=\"1546\"><strong data-start=\"1524\" data-end=\"1546\"><font color=\"#000000\"><br></font></strong></p></div><p><ol style=\"list-style-type: lower-alpha; margin-left: 25px;\"><li><font color=\"#000000\">First Name</font></li><li><font color=\"#000000\">Last Name</font></li><li><font color=\"#000000\">Gender: choose one from (Male, Female)</font></li><li><font color=\"#000000\">Social Media: choose more than one from (Facebook, Instagram, LinkedIn, X.com)<br></font></li></ol></p>\n<p data-start=\"1672\" data-end=\"1805\" data-is-last-node=\"\" data-is-only-node=\"\"></p>', '2025-10-22 08:50:00', 100, 'both', NULL, NULL, 1, 1, 'completed', '2025-10-20 13:52:10', '2025-10-24 14:35:44'),
(3, 'This is the testing assignment', 'This is the testing assignment<font color=\"#000000\">&nbsp;1111</font><div><font color=\"#000000\">This is the testing assignment This is the testing assignment This is the testing assignment&nbsp;</font></div><div><font color=\"#000000\">This is the testing assignment This is the testing assignment This is the testing assignment This is the testing assignment This is the testing assignment This is the testing assignment This is the testing assignment</font></div>', '2025-10-21 02:30:00', 100, 'both', NULL, NULL, 1, 1, 'removed', '2025-10-20 16:16:09', '2025-10-20 17:16:14');

-- --------------------------------------------------------

--
-- Table structure for table `courses`
--

CREATE TABLE `courses` (
  `id` int(11) NOT NULL,
  `code` varchar(20) NOT NULL,
  `title` varchar(100) NOT NULL,
  `description` text NOT NULL,
  `credits` int(11) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `max_students` int(11) NOT NULL,
  `instructor_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `courses`
--

INSERT INTO `courses` (`id`, `code`, `title`, `description`, `credits`, `start_date`, `end_date`, `is_active`, `max_students`, `instructor_id`, `created_at`, `updated_at`) VALUES
(1, 'SPEWI302', 'Development of web user interface', 'This module describes the skills, knowledge and attitudes required to the basics of web design and development tools and familiarize with HTML4 and HTML5 tags, creating and formatting content of web sites, use CSS rules and properties for web site layouts and content presentation. At the end of this module the students will be able to design responsive web sites, to combine HTML and CSS to create static web pages, to manage web pages on local computer and on remote servers, to use advanced web development tools known as WYSIWYG(what you see is what you get) tools. Students will be able to use CSS frameworks  to ease the development process.', 3, '2025-10-01', '2025-12-31', 1, 30, 1, '2025-10-20 11:19:09', '2025-10-20 11:19:09'),
(2, 'SPEGI302', 'GRAPHIC USER INTERFACE DESIGN', 'GRAPHIC USER INTERFACE DESIGN', 3, '2025-10-01', '2025-11-08', 1, 30, 1, '2025-10-25 10:21:03', '2025-10-25 10:21:03'),
(3, 'TEST101', 'Test Course', 'A test course for proctoring', 3, '2025-01-01', '2025-12-31', 1, 50, 11, '2025-11-07 20:18:18', '2025-11-07 20:18:18');

-- --------------------------------------------------------

--
-- Table structure for table `proctoring_events`
--

CREATE TABLE `proctoring_events` (
  `id` int(11) NOT NULL,
  `session_id` int(11) NOT NULL,
  `severity` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'low',
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `metadata` text COLLATE utf8mb4_unicode_ci,
  `screenshot_url` text COLLATE utf8mb4_unicode_ci,
  `video_timestamp` int(11) DEFAULT NULL,
  `reviewed` tinyint(1) NOT NULL DEFAULT '0',
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `event_type` enum('session_start','session_end','identity_verification','environment_scan','face_not_visible','multiple_faces','looking_away','tab_switch','window_minimized','browser_leave','suspicious_audio','device_disconnected','network_issue','screen_recording_start','screen_recording_stop','manual_flag','auto_flag','proctor_message','fullscreen_exited','camera_level_low','microphone_level_low','speaker_level_low','mobile_phone_detected','unauthorized_object_detected') COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `proctoring_events`
--

INSERT INTO `proctoring_events` (`id`, `session_id`, `severity`, `timestamp`, `description`, `metadata`, `screenshot_url`, `video_timestamp`, `reviewed`, `reviewed_by`, `reviewed_at`, `notes`, `created_at`, `updated_at`, `event_type`) VALUES
(58, 2, 'low', '2025-11-09 19:36:14', 'Proctoring session started', '{\"browser_info\":\"{\\\"userAgent\\\":\\\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\\\",\\\"platform\\\":\\\"MacIntel\\\",\\\"language\\\":\\\"en-US\\\",\\\"cookieEnabled\\\":true,\\\"screenWidth\\\":1512,\\\"screenHeight\\\":982}\",\"system_info\":\"{\\\"platform\\\":\\\"MacIntel\\\",\\\"language\\\":\\\"en-US\\\",\\\"screenResolution\\\":\\\"1512x982\\\"}\",\"ip_address\":\"\",\"location_data\":null}', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-09 19:36:14', '2025-11-09 19:36:14', 'session_start'),
(2779, 2, 'medium', '2025-11-25 20:51:33', 'Microphone activity below minimum threshold (7.716299019607844% < 50.00%)', '\"{\\\"current\\\":7.716299019607844,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T20:51:33.502Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 20:51:33', '2025-11-25 20:51:33', 'microphone_level_low'),
(2780, 2, 'medium', '2025-11-25 20:51:35', 'Microphone activity below minimum threshold (7.769607843137255% < 50.00%)', '\"{\\\"current\\\":7.769607843137255,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T20:51:35.446Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 20:51:35', '2025-11-25 20:51:35', 'microphone_level_low'),
(2781, 2, 'medium', '2025-11-25 20:51:37', 'Microphone activity below minimum threshold (1.5661764705882355% < 50.00%)', '\"{\\\"current\\\":1.5661764705882355,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T20:51:37.444Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 20:51:37', '2025-11-25 20:51:37', 'microphone_level_low'),
(2782, 2, 'medium', '2025-11-25 20:51:39', 'Microphone activity below minimum threshold (1.2622549019607843% < 50.00%)', '\"{\\\"current\\\":1.2622549019607843,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T20:51:39.447Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 20:51:39', '2025-11-25 20:51:39', 'microphone_level_low'),
(2783, 2, 'medium', '2025-11-25 20:51:41', 'Microphone activity below minimum threshold (4.879289215686274% < 50.00%)', '\"{\\\"current\\\":4.879289215686274,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T20:51:41.445Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 20:51:41', '2025-11-25 20:51:41', 'microphone_level_low'),
(2784, 2, 'medium', '2025-11-25 20:51:43', 'Microphone activity below minimum threshold (6.0379901960784315% < 50.00%)', '\"{\\\"current\\\":6.0379901960784315,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T20:51:43.442Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 20:51:43', '2025-11-25 20:51:43', 'microphone_level_low'),
(2785, 2, 'medium', '2025-11-25 20:51:45', 'Microphone activity below minimum threshold (13.022058823529411% < 50.00%)', '\"{\\\"current\\\":13.022058823529411,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T20:51:45.516Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 20:51:45', '2025-11-25 20:51:45', 'microphone_level_low'),
(2786, 2, 'medium', '2025-11-25 20:51:47', 'Microphone activity below minimum threshold (6.390318627450981% < 50.00%)', '\"{\\\"current\\\":6.390318627450981,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T20:51:47.447Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 20:51:47', '2025-11-25 20:51:47', 'microphone_level_low'),
(2787, 7, 'low', '2025-11-25 21:19:26', 'Proctoring session started', '{\"browser_info\":\"{\\\"userAgent\\\":\\\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\\\",\\\"platform\\\":\\\"MacIntel\\\",\\\"language\\\":\\\"en-US\\\",\\\"cookieEnabled\\\":true,\\\"screenWidth\\\":1512,\\\"screenHeight\\\":982}\",\"system_info\":\"{\\\"platform\\\":\\\"MacIntel\\\",\\\"language\\\":\\\"en-US\\\",\\\"screenResolution\\\":\\\"1512x982\\\"}\",\"ip_address\":\"\",\"location_data\":null}', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:26', '2025-11-25 21:19:26', 'session_start'),
(2788, 7, 'medium', '2025-11-25 21:19:30', 'Microphone activity below minimum threshold (7.694852941176471% < 50.00%)', '\"{\\\"current\\\":7.694852941176471,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:30.129Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:30', '2025-11-25 21:19:30', 'microphone_level_low'),
(2789, 7, 'medium', '2025-11-25 21:19:32', 'Microphone activity below minimum threshold (15.028186274509803% < 50.00%)', '\"{\\\"current\\\":15.028186274509803,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:32.068Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:32', '2025-11-25 21:19:32', 'microphone_level_low'),
(2790, 7, 'medium', '2025-11-25 21:19:34', 'Microphone activity below minimum threshold (2.9393382352941178% < 50.00%)', '\"{\\\"current\\\":2.9393382352941178,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:34.065Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:34', '2025-11-25 21:19:34', 'microphone_level_low'),
(2791, 7, 'medium', '2025-11-25 21:19:36', 'Microphone activity below minimum threshold (4.411151960784314% < 50.00%)', '\"{\\\"current\\\":4.411151960784314,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:36.067Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:36', '2025-11-25 21:19:36', 'microphone_level_low'),
(2792, 7, 'medium', '2025-11-25 21:19:38', 'Microphone activity below minimum threshold (4.030024509803922% < 50.00%)', '\"{\\\"current\\\":4.030024509803922,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:38.067Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:38', '2025-11-25 21:19:38', 'microphone_level_low'),
(2793, 7, 'medium', '2025-11-25 21:19:40', 'Microphone activity below minimum threshold (5.4693627450980395% < 50.00%)', '\"{\\\"current\\\":5.4693627450980395,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:40.067Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:40', '2025-11-25 21:19:40', 'microphone_level_low'),
(2794, 7, 'medium', '2025-11-25 21:19:42', 'Microphone activity below minimum threshold (3.7120098039215685% < 50.00%)', '\"{\\\"current\\\":3.7120098039215685,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:42.068Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:42', '2025-11-25 21:19:42', 'microphone_level_low'),
(2795, 7, 'medium', '2025-11-25 21:19:44', 'Microphone activity below minimum threshold (3.105392156862745% < 50.00%)', '\"{\\\"current\\\":3.105392156862745,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:44.068Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:44', '2025-11-25 21:19:44', 'microphone_level_low'),
(2796, 7, 'medium', '2025-11-25 21:19:46', 'Microphone activity below minimum threshold (3.636642156862745% < 50.00%)', '\"{\\\"current\\\":3.636642156862745,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:46.068Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:46', '2025-11-25 21:19:46', 'microphone_level_low'),
(2797, 7, 'medium', '2025-11-25 21:19:48', 'Microphone activity below minimum threshold (4.6390931372549025% < 50.00%)', '\"{\\\"current\\\":4.6390931372549025,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:48.068Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:48', '2025-11-25 21:19:48', 'microphone_level_low'),
(2798, 7, 'medium', '2025-11-25 21:19:50', 'Microphone activity below minimum threshold (8.0625% < 50.00%)', '\"{\\\"current\\\":8.0625,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:50.072Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:50', '2025-11-25 21:19:50', 'microphone_level_low'),
(2799, 7, 'medium', '2025-11-25 21:19:52', 'Microphone activity below minimum threshold (4.135416666666666% < 50.00%)', '\"{\\\"current\\\":4.135416666666666,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:52.068Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:52', '2025-11-25 21:19:52', 'microphone_level_low'),
(2800, 7, 'medium', '2025-11-25 21:19:54', 'Microphone activity below minimum threshold (4.2254901960784315% < 50.00%)', '\"{\\\"current\\\":4.2254901960784315,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:54.092Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:54', '2025-11-25 21:19:54', 'microphone_level_low'),
(2801, 7, 'medium', '2025-11-25 21:19:56', 'Microphone activity below minimum threshold (2.9987745098039214% < 50.00%)', '\"{\\\"current\\\":2.9987745098039214,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:56.068Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:56', '2025-11-25 21:19:56', 'microphone_level_low'),
(2802, 7, 'medium', '2025-11-25 21:19:58', 'Microphone activity below minimum threshold (6.704656862745098% < 50.00%)', '\"{\\\"current\\\":6.704656862745098,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:19:58.066Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:19:58', '2025-11-25 21:19:58', 'microphone_level_low'),
(2803, 7, 'medium', '2025-11-25 21:20:00', 'Microphone activity below minimum threshold (2.3143382352941178% < 50.00%)', '\"{\\\"current\\\":2.3143382352941178,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:20:00.072Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:20:00', '2025-11-25 21:20:00', 'microphone_level_low'),
(2804, 7, 'medium', '2025-11-25 21:20:02', 'Microphone activity below minimum threshold (4.688725490196079% < 50.00%)', '\"{\\\"current\\\":4.688725490196079,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:20:02.077Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:20:02', '2025-11-25 21:20:02', 'microphone_level_low'),
(2805, 7, 'medium', '2025-11-25 21:20:04', 'Microphone activity below minimum threshold (6.770833333333333% < 50.00%)', '\"{\\\"current\\\":6.770833333333333,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:20:04.065Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:20:04', '2025-11-25 21:20:04', 'microphone_level_low'),
(2806, 7, 'medium', '2025-11-25 21:20:06', 'Microphone activity below minimum threshold (7.2506127450980395% < 50.00%)', '\"{\\\"current\\\":7.2506127450980395,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:20:06.069Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:20:06', '2025-11-25 21:20:06', 'microphone_level_low'),
(2807, 7, 'medium', '2025-11-25 21:20:08', 'Microphone activity below minimum threshold (10.029411764705882% < 50.00%)', '\"{\\\"current\\\":10.029411764705882,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:20:08.068Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:20:08', '2025-11-25 21:20:08', 'microphone_level_low'),
(2808, 7, 'medium', '2025-11-25 21:35:44', 'Microphone activity below minimum threshold (4.675857843137255% < 50.00%)', '\"{\\\"current\\\":4.675857843137255,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:35:44.541Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:35:44', '2025-11-25 21:35:44', 'microphone_level_low'),
(2809, 7, 'medium', '2025-11-25 21:35:46', 'Microphone activity below minimum threshold (2.338235294117647% < 50.00%)', '\"{\\\"current\\\":2.338235294117647,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:35:46.509Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:35:46', '2025-11-25 21:35:46', 'microphone_level_low'),
(2810, 7, 'medium', '2025-11-25 21:35:48', 'Microphone activity below minimum threshold (4.857230392156863% < 50.00%)', '\"{\\\"current\\\":4.857230392156863,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:35:48.505Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:35:48', '2025-11-25 21:35:48', 'microphone_level_low'),
(2811, 7, 'medium', '2025-11-25 21:35:50', 'Microphone activity below minimum threshold (11.637254901960786% < 50.00%)', '\"{\\\"current\\\":11.637254901960786,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:35:50.602Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:35:50', '2025-11-25 21:35:50', 'microphone_level_low'),
(2812, 7, 'medium', '2025-11-25 21:35:52', 'Microphone activity below minimum threshold (6.227328431372549% < 50.00%)', '\"{\\\"current\\\":6.227328431372549,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:35:52.509Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:35:52', '2025-11-25 21:35:52', 'microphone_level_low'),
(2813, 7, 'medium', '2025-11-25 21:35:54', 'Microphone activity below minimum threshold (3.3560049019607843% < 50.00%)', '\"{\\\"current\\\":3.3560049019607843,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:35:54.505Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:35:54', '2025-11-25 21:35:54', 'microphone_level_low'),
(2814, 7, 'medium', '2025-11-25 21:35:56', 'Microphone activity below minimum threshold (1.6090686274509804% < 50.00%)', '\"{\\\"current\\\":1.6090686274509804,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:35:56.505Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:35:56', '2025-11-25 21:35:56', 'microphone_level_low'),
(2815, 7, 'medium', '2025-11-25 21:36:53', 'Microphone activity below minimum threshold (2.1139705882352944% < 50.00%)', '\"{\\\"current\\\":2.1139705882352944,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:36:53.566Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:36:53', '2025-11-25 21:36:53', 'microphone_level_low'),
(2816, 7, 'medium', '2025-11-25 21:36:55', 'Microphone activity below minimum threshold (2.7622549019607843% < 50.00%)', '\"{\\\"current\\\":2.7622549019607843,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:36:55.503Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:36:55', '2025-11-25 21:36:55', 'microphone_level_low'),
(2817, 7, 'medium', '2025-11-25 21:36:57', 'Microphone activity below minimum threshold (4.044117647058823% < 50.00%)', '\"{\\\"current\\\":4.044117647058823,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:36:57.531Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:36:57', '2025-11-25 21:36:57', 'microphone_level_low'),
(2818, 7, 'medium', '2025-11-25 21:36:59', 'Microphone activity below minimum threshold (6.3327205882352935% < 50.00%)', '\"{\\\"current\\\":6.3327205882352935,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:36:59.506Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:36:59', '2025-11-25 21:36:59', 'microphone_level_low'),
(2819, 7, 'medium', '2025-11-25 21:37:01', 'Microphone activity below minimum threshold (12.378063725490197% < 50.00%)', '\"{\\\"current\\\":12.378063725490197,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:37:01.521Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:37:01', '2025-11-25 21:37:01', 'microphone_level_low'),
(2820, 7, 'medium', '2025-11-25 21:37:03', 'Microphone activity below minimum threshold (3.167892156862745% < 50.00%)', '\"{\\\"current\\\":3.167892156862745,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:37:03.521Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:37:03', '2025-11-25 21:37:03', 'microphone_level_low'),
(2821, 7, 'medium', '2025-11-25 21:37:05', 'Microphone activity below minimum threshold (2.8008578431372553% < 50.00%)', '\"{\\\"current\\\":2.8008578431372553,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:37:05.521Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:37:05', '2025-11-25 21:37:05', 'microphone_level_low'),
(2822, 7, 'medium', '2025-11-25 21:37:07', 'Microphone activity below minimum threshold (19.30698529411765% < 50.00%)', '\"{\\\"current\\\":19.30698529411765,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:37:07.519Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:37:07', '2025-11-25 21:37:07', 'microphone_level_low'),
(2823, 7, 'medium', '2025-11-25 21:37:09', 'Microphone activity below minimum threshold (15.090073529411763% < 50.00%)', '\"{\\\"current\\\":15.090073529411763,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:37:09.513Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:37:09', '2025-11-25 21:37:09', 'microphone_level_low'),
(2824, 7, 'medium', '2025-11-25 21:37:11', 'Microphone activity below minimum threshold (8.409313725490197% < 50.00%)', '\"{\\\"current\\\":8.409313725490197,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:37:11.528Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:37:11', '2025-11-25 21:37:11', 'microphone_level_low'),
(2825, 7, 'medium', '2025-11-25 21:42:42', 'Microphone activity below minimum threshold (8.028799019607844% < 50.00%)', '\"{\\\"current\\\":8.028799019607844,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:42:42.088Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:42:42', '2025-11-25 21:42:42', 'microphone_level_low'),
(2826, 7, 'medium', '2025-11-25 21:42:44', 'Microphone activity below minimum threshold (0.8658088235294119% < 50.00%)', '\"{\\\"current\\\":0.8658088235294119,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:42:44.049Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:42:44', '2025-11-25 21:42:44', 'microphone_level_low'),
(2827, 7, 'medium', '2025-11-25 21:42:46', 'Microphone activity below minimum threshold (7.758578431372549% < 50.00%)', '\"{\\\"current\\\":7.758578431372549,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:42:46.050Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:42:46', '2025-11-25 21:42:46', 'microphone_level_low'),
(2828, 7, 'medium', '2025-11-25 21:42:48', 'Microphone activity below minimum threshold (8.464460784313726% < 50.00%)', '\"{\\\"current\\\":8.464460784313726,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:42:48.052Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:42:48', '2025-11-25 21:42:48', 'microphone_level_low'),
(2829, 7, 'medium', '2025-11-25 21:42:50', 'Microphone activity below minimum threshold (1.3792892156862744% < 50.00%)', '\"{\\\"current\\\":1.3792892156862744,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:42:50.052Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:42:50', '2025-11-25 21:42:50', 'microphone_level_low'),
(2830, 7, 'medium', '2025-11-25 21:42:52', 'Microphone activity below minimum threshold (10.620710784313726% < 50.00%)', '\"{\\\"current\\\":10.620710784313726,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:42:52.049Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:42:52', '2025-11-25 21:42:52', 'microphone_level_low'),
(2831, 7, 'medium', '2025-11-25 21:42:54', 'Microphone activity below minimum threshold (6.240808823529412% < 50.00%)', '\"{\\\"current\\\":6.240808823529412,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:42:54.048Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:42:54', '2025-11-25 21:42:54', 'microphone_level_low'),
(2832, 7, 'medium', '2025-11-25 21:42:56', 'Microphone activity below minimum threshold (17.971200980392158% < 50.00%)', '\"{\\\"current\\\":17.971200980392158,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:42:56.047Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:42:56', '2025-11-25 21:42:56', 'microphone_level_low'),
(2833, 7, 'medium', '2025-11-25 21:42:58', 'Microphone activity below minimum threshold (8.558823529411764% < 50.00%)', '\"{\\\"current\\\":8.558823529411764,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:42:58.054Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:42:58', '2025-11-25 21:42:58', 'microphone_level_low'),
(2834, 7, 'medium', '2025-11-25 21:43:00', 'Microphone activity below minimum threshold (23.018382352941174% < 50.00%)', '\"{\\\"current\\\":23.018382352941174,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:00.049Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:00', '2025-11-25 21:43:00', 'microphone_level_low'),
(2835, 7, 'medium', '2025-11-25 21:43:02', 'Microphone activity below minimum threshold (4.286151960784314% < 50.00%)', '\"{\\\"current\\\":4.286151960784314,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:02.082Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:02', '2025-11-25 21:43:02', 'microphone_level_low'),
(2836, 7, 'medium', '2025-11-25 21:43:04', 'Microphone activity below minimum threshold (12.42095588235294% < 50.00%)', '\"{\\\"current\\\":12.42095588235294,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:04.064Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:04', '2025-11-25 21:43:04', 'microphone_level_low'),
(2837, 7, 'medium', '2025-11-25 21:43:06', 'Microphone activity below minimum threshold (21.88357843137255% < 50.00%)', '\"{\\\"current\\\":21.88357843137255,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:06.057Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:06', '2025-11-25 21:43:06', 'microphone_level_low'),
(2838, 7, 'medium', '2025-11-25 21:43:08', 'Microphone activity below minimum threshold (22.71139705882353% < 50.00%)', '\"{\\\"current\\\":22.71139705882353,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:08.085Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:08', '2025-11-25 21:43:08', 'microphone_level_low'),
(2839, 7, 'medium', '2025-11-25 21:43:10', 'Microphone activity below minimum threshold (21.70281862745098% < 50.00%)', '\"{\\\"current\\\":21.70281862745098,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:10.046Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:10', '2025-11-25 21:43:10', 'microphone_level_low'),
(2840, 7, 'medium', '2025-11-25 21:43:12', 'Microphone activity below minimum threshold (10.48529411764706% < 50.00%)', '\"{\\\"current\\\":10.48529411764706,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:12.049Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:12', '2025-11-25 21:43:12', 'microphone_level_low'),
(2841, 7, 'medium', '2025-11-25 21:43:14', 'Microphone activity below minimum threshold (8.041666666666668% < 50.00%)', '\"{\\\"current\\\":8.041666666666668,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:14.049Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:14', '2025-11-25 21:43:14', 'microphone_level_low'),
(2842, 7, 'medium', '2025-11-25 21:43:16', 'Microphone activity below minimum threshold (11.97671568627451% < 50.00%)', '\"{\\\"current\\\":11.97671568627451,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:16.047Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:16', '2025-11-25 21:43:16', 'microphone_level_low'),
(2843, 7, 'medium', '2025-11-25 21:43:40', 'Microphone activity below minimum threshold (3.2254901960784315% < 50.00%)', '\"{\\\"current\\\":3.2254901960784315,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:40.418Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:40', '2025-11-25 21:43:40', 'microphone_level_low'),
(2844, 7, 'medium', '2025-11-25 21:43:42', 'Microphone activity below minimum threshold (4.645220588235294% < 50.00%)', '\"{\\\"current\\\":4.645220588235294,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:42.320Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:42', '2025-11-25 21:43:42', 'microphone_level_low'),
(2845, 7, 'medium', '2025-11-25 21:43:44', 'Microphone activity below minimum threshold (6.4767156862745106% < 50.00%)', '\"{\\\"current\\\":6.4767156862745106,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:44.326Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:44', '2025-11-25 21:43:44', 'microphone_level_low'),
(2846, 7, 'medium', '2025-11-25 21:43:46', 'Microphone activity below minimum threshold (16.11151960784314% < 50.00%)', '\"{\\\"current\\\":16.11151960784314,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:46.320Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:46', '2025-11-25 21:43:46', 'microphone_level_low'),
(2847, 7, 'medium', '2025-11-25 21:43:48', 'Microphone activity below minimum threshold (2.0294117647058822% < 50.00%)', '\"{\\\"current\\\":2.0294117647058822,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:48.318Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:48', '2025-11-25 21:43:48', 'microphone_level_low'),
(2848, 7, 'medium', '2025-11-25 21:43:50', 'Microphone activity below minimum threshold (17.82843137254902% < 50.00%)', '\"{\\\"current\\\":17.82843137254902,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:50.318Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:50', '2025-11-25 21:43:50', 'microphone_level_low'),
(2849, 7, 'medium', '2025-11-25 21:43:52', 'Microphone activity below minimum threshold (7.041666666666667% < 50.00%)', '\"{\\\"current\\\":7.041666666666667,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:52.370Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:52', '2025-11-25 21:43:52', 'microphone_level_low'),
(2850, 7, 'medium', '2025-11-25 21:43:54', 'Microphone activity below minimum threshold (13.592524509803921% < 50.00%)', '\"{\\\"current\\\":13.592524509803921,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:54.321Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:54', '2025-11-25 21:43:54', 'microphone_level_low'),
(2851, 7, 'medium', '2025-11-25 21:43:56', 'Microphone activity below minimum threshold (11.243872549019608% < 50.00%)', '\"{\\\"current\\\":11.243872549019608,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:56.319Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:56', '2025-11-25 21:43:56', 'microphone_level_low'),
(2852, 7, 'medium', '2025-11-25 21:43:58', 'Microphone activity below minimum threshold (4.985294117647059% < 50.00%)', '\"{\\\"current\\\":4.985294117647059,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:43:58.368Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:43:58', '2025-11-25 21:43:58', 'microphone_level_low'),
(2853, 7, 'medium', '2025-11-25 21:44:00', 'Microphone activity below minimum threshold (19.19546568627451% < 50.00%)', '\"{\\\"current\\\":19.19546568627451,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:44:00.367Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:44:00', '2025-11-25 21:44:00', 'microphone_level_low'),
(2854, 7, 'medium', '2025-11-25 21:44:02', 'Microphone activity below minimum threshold (5.6734068627450975% < 50.00%)', '\"{\\\"current\\\":5.6734068627450975,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:44:02.316Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:44:02', '2025-11-25 21:44:02', 'microphone_level_low'),
(2855, 7, 'medium', '2025-11-25 21:44:04', 'Microphone activity below minimum threshold (4.798406862745098% < 50.00%)', '\"{\\\"current\\\":4.798406862745098,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:44:04.331Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:44:04', '2025-11-25 21:44:04', 'microphone_level_low'),
(2856, 7, 'medium', '2025-11-25 21:44:06', 'Microphone activity below minimum threshold (23.317401960784316% < 50.00%)', '\"{\\\"current\\\":23.317401960784316,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:44:06.316Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:44:06', '2025-11-25 21:44:06', 'microphone_level_low'),
(2857, 7, 'medium', '2025-11-25 21:44:08', 'Microphone activity below minimum threshold (8.626225490196077% < 50.00%)', '\"{\\\"current\\\":8.626225490196077,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:44:08.318Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:44:08', '2025-11-25 21:44:08', 'microphone_level_low'),
(2858, 7, 'medium', '2025-11-25 21:58:17', 'Microphone activity below minimum threshold (6.981617647058824% < 50.00%)', '\"{\\\"current\\\":6.981617647058824,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:58:17.713Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:58:17', '2025-11-25 21:58:17', 'microphone_level_low'),
(2859, 7, 'medium', '2025-11-25 21:58:19', 'Microphone activity below minimum threshold (12.314950980392156% < 50.00%)', '\"{\\\"current\\\":12.314950980392156,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:58:19.710Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:58:19', '2025-11-25 21:58:19', 'microphone_level_low'),
(2860, 7, 'medium', '2025-11-25 21:58:21', 'Microphone activity below minimum threshold (1.3174019607843137% < 50.00%)', '\"{\\\"current\\\":1.3174019607843137,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:58:21.775Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:58:21', '2025-11-25 21:58:21', 'microphone_level_low'),
(2861, 7, 'medium', '2025-11-25 21:58:23', 'Microphone activity below minimum threshold (8.88296568627451% < 50.00%)', '\"{\\\"current\\\":8.88296568627451,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:58:23.775Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:58:23', '2025-11-25 21:58:23', 'microphone_level_low'),
(2862, 7, 'medium', '2025-11-25 21:58:25', 'Microphone activity below minimum threshold (5.662377450980392% < 50.00%)', '\"{\\\"current\\\":5.662377450980392,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:58:25.712Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:58:25', '2025-11-25 21:58:25', 'microphone_level_low'),
(2863, 7, 'medium', '2025-11-25 21:58:27', 'Microphone activity below minimum threshold (6.145833333333333% < 50.00%)', '\"{\\\"current\\\":6.145833333333333,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:58:27.710Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:58:27', '2025-11-25 21:58:27', 'microphone_level_low'),
(2864, 7, 'medium', '2025-11-25 21:58:29', 'Microphone activity below minimum threshold (0.3829656862745098% < 50.00%)', '\"{\\\"current\\\":0.3829656862745098,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:58:29.708Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:58:29', '2025-11-25 21:58:29', 'microphone_level_low'),
(2865, 7, 'medium', '2025-11-25 21:58:31', 'Microphone activity below minimum threshold (9.685661764705882% < 50.00%)', '\"{\\\"current\\\":9.685661764705882,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:58:31.714Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:58:31', '2025-11-25 21:58:31', 'microphone_level_low'),
(2866, 7, 'medium', '2025-11-25 21:58:33', 'Microphone activity below minimum threshold (5.7567401960784315% < 50.00%)', '\"{\\\"current\\\":5.7567401960784315,\\\"required\\\":\\\"50.00\\\",\\\"timestamp\\\":\\\"2025-11-25T21:58:33.713Z\\\"}\"', NULL, NULL, 0, NULL, NULL, NULL, '2025-11-25 21:58:33', '2025-11-25 21:58:33', 'microphone_level_low');

-- --------------------------------------------------------

--
-- Table structure for table `proctoring_sessions`
--

CREATE TABLE `proctoring_sessions` (
  `id` int(11) NOT NULL,
  `quiz_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `proctor_id` int(11) DEFAULT NULL,
  `session_token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('setup','active','paused','completed','terminated','flagged') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'setup',
  `mode` enum('live_proctoring','automated_proctoring','record_review') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'automated_proctoring',
  `start_time` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL,
  `duration_minutes` int(11) DEFAULT NULL,
  `browser_info` text COLLATE utf8mb4_unicode_ci,
  `system_info` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location_data` text COLLATE utf8mb4_unicode_ci,
  `identity_verified` tinyint(1) NOT NULL DEFAULT '0',
  `environment_verified` tinyint(1) NOT NULL DEFAULT '0',
  `flags_count` int(11) NOT NULL DEFAULT '0',
  `risk_score` decimal(5,2) NOT NULL DEFAULT '0.00',
  `recording_url` text COLLATE utf8mb4_unicode_ci,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_connected` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Tracks if the student is currently connected to the proctoring session',
  `last_connection_time` datetime DEFAULT NULL COMMENT 'Timestamp of the student''s last connection to the session'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `proctoring_sessions`
--

INSERT INTO `proctoring_sessions` (`id`, `quiz_id`, `student_id`, `proctor_id`, `session_token`, `status`, `mode`, `start_time`, `end_time`, `duration_minutes`, `browser_info`, `system_info`, `ip_address`, `location_data`, `identity_verified`, `environment_verified`, `flags_count`, `risk_score`, `recording_url`, `notes`, `created_at`, `updated_at`, `is_connected`, `last_connection_time`) VALUES
(2, 9, 3, NULL, 'proctor_9_3_1762716974431_gg94deagn', 'active', 'live_proctoring', '2025-11-09 19:36:14', NULL, NULL, '{\"userAgent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\",\"platform\":\"MacIntel\",\"language\":\"en-US\",\"cookieEnabled\":true,\"screenWidth\":1512,\"screenHeight\":982}', '{\"platform\":\"MacIntel\",\"language\":\"en-US\",\"screenResolution\":\"1512x982\"}', '', NULL, 0, 0, 0, '0.00', NULL, NULL, '2025-11-09 19:36:14', '2025-11-09 19:36:14', 1, '2025-11-09 19:36:14'),
(7, 14, 3, NULL, 'proctor_14_3_1764105566895_b9oich6lp', 'active', 'automated_proctoring', '2025-11-25 21:19:26', NULL, NULL, '{\"userAgent\":\"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\",\"platform\":\"MacIntel\",\"language\":\"en-US\",\"cookieEnabled\":true,\"screenWidth\":1512,\"screenHeight\":982}', '{\"platform\":\"MacIntel\",\"language\":\"en-US\",\"screenResolution\":\"1512x982\"}', '', NULL, 0, 0, 0, '0.00', NULL, NULL, '2025-11-25 21:19:26', '2025-11-25 21:19:26', 1, '2025-11-25 21:19:26');

-- --------------------------------------------------------

--
-- Table structure for table `proctoring_settings`
--

CREATE TABLE `proctoring_settings` (
  `id` int(11) NOT NULL,
  `quiz_id` int(11) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `mode` enum('automated','live','record_review','disabled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'automated',
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
  `max_flags_allowed` int(11) NOT NULL DEFAULT '5',
  `auto_terminate_on_high_risk` tinyint(1) NOT NULL DEFAULT '0',
  `risk_threshold` decimal(5,2) NOT NULL DEFAULT '75.00',
  `require_proctor_approval` tinyint(1) NOT NULL DEFAULT '0',
  `recording_retention_days` int(11) NOT NULL DEFAULT '90',
  `allow_multiple_faces` tinyint(1) NOT NULL DEFAULT '0',
  `face_detection_sensitivity` decimal(5,2) NOT NULL DEFAULT '70.00',
  `suspicious_behavior_detection` tinyint(1) NOT NULL DEFAULT '1',
  `alert_instructors` tinyint(1) NOT NULL DEFAULT '1',
  `alert_emails` text COLLATE utf8mb4_unicode_ci,
  `custom_instructions` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `require_fullscreen` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Require student to stay in fullscreen mode during quiz',
  `min_camera_level` decimal(5,2) NOT NULL DEFAULT '50.00' COMMENT 'Minimum camera activity level required (0-100%)',
  `min_microphone_level` decimal(5,2) NOT NULL DEFAULT '50.00' COMMENT 'Minimum microphone activity level required (0-100%)',
  `min_speaker_level` decimal(5,2) NOT NULL DEFAULT '50.00' COMMENT 'Minimum speaker volume level required (0-100%)',
  `enable_face_detection` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Enable face detection to ensure student face is visible',
  `enable_object_detection` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Enable object detection to prevent unauthorized materials',
  `object_detection_sensitivity` decimal(5,2) NOT NULL DEFAULT '70.00' COMMENT 'Sensitivity for object detection (0-100%)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `proctoring_settings`
--

INSERT INTO `proctoring_settings` (`id`, `quiz_id`, `enabled`, `mode`, `require_identity_verification`, `require_environment_scan`, `allow_screen_recording`, `allow_audio_monitoring`, `allow_video_monitoring`, `lockdown_browser`, `prevent_tab_switching`, `prevent_window_minimization`, `prevent_copy_paste`, `prevent_right_click`, `max_flags_allowed`, `auto_terminate_on_high_risk`, `risk_threshold`, `require_proctor_approval`, `recording_retention_days`, `allow_multiple_faces`, `face_detection_sensitivity`, `suspicious_behavior_detection`, `alert_instructors`, `alert_emails`, `custom_instructions`, `created_at`, `updated_at`, `require_fullscreen`, `min_camera_level`, `min_microphone_level`, `min_speaker_level`, `enable_face_detection`, `enable_object_detection`, `object_detection_sensitivity`) VALUES
(1, 9, 1, 'live', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 0, '75.00', 1, 90, 0, '70.00', 1, 1, NULL, NULL, '2025-11-07 21:10:02', '2025-11-07 22:49:24', 1, '50.00', '50.00', '50.00', 1, 1, '70.00'),
(4, 14, 1, 'automated', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 0, '75.00', 0, 90, 0, '70.00', 1, 1, NULL, NULL, '2025-11-25 21:10:42', '2025-11-25 21:10:42', 1, '50.00', '50.00', '50.00', 1, 1, '70.00');

-- --------------------------------------------------------

--
-- Stand-in structure for view `question_difficulty`
-- (See below for the actual view)
--
CREATE TABLE `question_difficulty` (
`question_id` int(11)
,`quiz_id` int(11)
,`question_type` enum('single_choice','multiple_choice','true_false','matching','fill_blank','dropdown','numerical','algorithmic','short_answer','coding','logical_expression','drag_drop','ordering')
,`points` decimal(5,2)
,`total_attempts` bigint(21)
,`correct_attempts` bigint(21)
,`success_rate` decimal(27,4)
,`average_points_earned` decimal(9,6)
,`average_time_seconds` decimal(14,4)
);

-- --------------------------------------------------------

--
-- Table structure for table `quizzes`
--

CREATE TABLE `quizzes` (
  `id` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `instructions` text,
  `status` enum('draft','in_progress','published','completed') NOT NULL DEFAULT 'draft',
  `type` enum('practice','graded','exam') NOT NULL DEFAULT 'practice',
  `time_limit` int(11) DEFAULT NULL,
  `max_attempts` int(11) DEFAULT NULL,
  `passing_score` decimal(5,2) DEFAULT NULL,
  `show_results_immediately` tinyint(1) NOT NULL DEFAULT '1',
  `randomize_questions` tinyint(1) NOT NULL DEFAULT '0',
  `show_correct_answers` tinyint(1) NOT NULL DEFAULT '0',
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `course_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `enable_automatic_grading` tinyint(1) NOT NULL DEFAULT '1',
  `require_manual_grading` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `quizzes`
--

INSERT INTO `quizzes` (`id`, `title`, `description`, `instructions`, `status`, `type`, `time_limit`, `max_attempts`, `passing_score`, `show_results_immediately`, `randomize_questions`, `show_correct_answers`, `is_public`, `start_date`, `end_date`, `course_id`, `created_by`, `created_at`, `updated_at`, `enable_automatic_grading`, `require_manual_grading`) VALUES
(1, 'This is Mathematics', 'This is Mathematics desc', 'This is Mathematics', 'draft', 'practice', 20, 9, '60.00', 1, 0, 1, 1, NULL, NULL, 2, 1, '2025-10-25 16:20:36', '2025-10-26 09:36:38', 0, 1),
(2, 'This is testing', 'This is the question description details', 'This is the instruction', 'draft', 'practice', 50, 9, '60.00', 1, 1, 1, 1, '2025-10-27 17:09:54', '2025-10-29 00:00:00', 2, 1, '2025-10-27 15:04:52', '2025-10-27 15:08:39', 0, 1),
(3, '1. JavaScript Fundamentals Quiz', 'Test your knowledge of JavaScript basics including variables, functions, and data types.', '', 'published', 'practice', 30, 3, '70.00', 1, 0, 1, 1, '2025-01-01 00:00:00', '2025-12-31 23:59:59', 1, 1, '2025-10-27 17:22:11', '2025-11-03 22:11:12', 1, 1),
(4, 'JavaScript Fundamentals Quiz', 'Test your knowledge of JavaScript basics including variables, functions, and data types.', NULL, 'published', 'practice', 30, 3, '70.00', 1, 0, 1, 1, '2025-01-01 00:00:00', '2025-12-31 23:59:59', 1, 1, '2025-10-27 17:22:47', '2025-10-27 17:22:47', 0, 1),
(5, 'Web Development Basics', 'Test your understanding of web development fundamentals covered in the course.', NULL, 'published', 'graded', 45, 2, '60.00', 0, 1, 1, 0, '2025-10-01 00:00:00', '2025-11-30 23:59:59', 2, 2, '2025-10-27 17:22:47', '2025-10-27 17:22:47', 0, 1),
(6, 'JavaScript Fundamentals Quiz', 'Test your knowledge of JavaScript basics including variables, functions, and data types.', NULL, 'published', 'practice', 30, 3, '70.00', 1, 0, 1, 1, '2025-01-01 00:00:00', '2025-12-31 23:59:59', 1, 1, '2025-10-27 17:29:57', '2025-11-07 23:06:39', 0, 1),
(7, 'Web Development Basics', 'Test your understanding of web development fundamentals covered in the course.', NULL, 'published', 'graded', 45, 2, '60.00', 0, 1, 1, 0, '2025-10-01 00:00:00', '2025-11-30 23:59:59', 2, 2, '2025-10-27 17:29:57', '2025-10-27 17:29:57', 0, 1),
(8, 'Javascript Quiz for Testing', 'This is the description', '', 'published', 'practice', 8, 1, '50.00', 1, 0, 1, 1, NULL, NULL, 1, 1, '2025-11-04 13:28:08', '2025-11-04 13:31:39', 0, 1),
(9, 'TypeScript Test', 'This is the typsecript test, make sure you answer all questions', '', 'published', 'practice', NULL, 1, '50.00', 1, 0, 0, 1, NULL, NULL, 1, 1, '2025-11-07 18:48:14', '2025-11-07 18:53:04', 0, 1),
(12, 'Grading System Test Quiz', 'Comprehensive quiz to test all question types and grading functionality.', NULL, 'published', 'practice', 60, 5, '80.00', 1, 0, 1, 1, '2025-01-01 00:00:00', '2025-12-31 23:59:59', 1, 1, '2025-11-25 22:26:49', '2025-11-25 22:26:49', 1, 0),
(13, 'Grading System Test Quiz', 'Comprehensive quiz to test all question types and grading functionality.', NULL, 'published', 'practice', 60, 5, '80.00', 1, 0, 1, 1, '2025-01-01 00:00:00', '2025-12-31 23:59:59', 1, 1, '2025-11-25 22:27:35', '2025-11-25 22:27:35', 1, 0),
(14, 'Psychometric Test for Web Developer', 'Each question is tailored for a web developer role, emphasizing logic and professional reasoning rather than technical syntax', NULL, 'published', 'graded', NULL, NULL, NULL, 1, 1, 1, 1, NULL, NULL, 1, 1, '2025-11-25 21:10:31', '2025-11-25 21:17:58', 1, 0);

-- --------------------------------------------------------

--
-- Stand-in structure for view `quiz_analytics`
-- (See below for the actual view)
--
CREATE TABLE `quiz_analytics` (
`quiz_id` int(11)
,`title` varchar(200)
,`course_id` int(11)
,`total_submissions` bigint(21)
,`average_score` decimal(9,6)
,`average_time_minutes` decimal(18,8)
,`pass_rate` decimal(30,4)
,`completed_submissions` bigint(21)
,`graded_submissions` bigint(21)
);

-- --------------------------------------------------------

--
-- Table structure for table `quiz_attempts`
--

CREATE TABLE `quiz_attempts` (
  `id` int(11) NOT NULL,
  `quiz_id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `is_correct` tinyint(1) DEFAULT NULL,
  `points_earned` decimal(5,2) DEFAULT NULL,
  `time_taken` int(11) DEFAULT NULL,
  `status` enum('in_progress','completed','timed_out','abandoned') NOT NULL DEFAULT 'in_progress',
  `started_at` datetime NOT NULL,
  `completed_at` datetime DEFAULT NULL,
  `submission_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `submitted_answer` json DEFAULT NULL,
  `correct_answer` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `quiz_attempts`
--

INSERT INTO `quiz_attempts` (`id`, `quiz_id`, `question_id`, `student_id`, `is_correct`, `points_earned`, `time_taken`, `status`, `started_at`, `completed_at`, `submission_id`, `created_at`, `updated_at`, `submitted_answer`, `correct_answer`) VALUES
(1, 14, 53, 3, 0, '0.00', 1692, 'timed_out', '2025-11-25 21:58:17', '2025-11-25 21:58:31', 44, '2025-11-25 21:58:17', '2025-11-25 21:58:31', '{\"selected_option_index\": 1}', '{\"selected_option_index\": 1}'),
(2, 14, 54, 3, 0, '0.00', 7080, 'timed_out', '2025-11-25 21:58:22', '2025-11-25 21:58:31', 44, '2025-11-25 21:58:22', '2025-11-25 21:58:31', '{\"selected_option_index\": 2}', '{\"selected_option_index\": 2}'),
(3, 14, 55, 3, 0, '0.00', 9126, 'timed_out', '2025-11-25 21:58:24', '2025-11-25 21:58:31', 44, '2025-11-25 21:58:24', '2025-11-25 21:58:31', '{\"selected_option_index\": 3}', '{\"selected_option_index\": 3}'),
(4, 14, 56, 3, 0, '0.00', 11542, 'timed_out', '2025-11-25 21:58:26', '2025-11-25 21:58:31', 44, '2025-11-25 21:58:26', '2025-11-25 21:58:31', '{\"selected_option_indices\": [0]}', '{\"selected_option_indices\": [0, 1, 3]}'),
(5, 14, 57, 3, 0, '0.00', 15218, 'timed_out', '2025-11-25 21:58:29', '2025-11-25 21:58:31', 44, '2025-11-25 21:58:29', '2025-11-25 21:58:31', '{\"selected_answer\": false}', '{\"selected_answer\": false}');

-- --------------------------------------------------------

--
-- Table structure for table `quiz_questions`
--

CREATE TABLE `quiz_questions` (
  `id` int(11) NOT NULL,
  `quiz_id` int(11) NOT NULL,
  `question_type` enum('single_choice','multiple_choice','true_false','matching','fill_blank','dropdown','numerical','algorithmic','short_answer','coding','logical_expression','drag_drop','ordering') NOT NULL,
  `question_text` text NOT NULL,
  `question_data` json NOT NULL,
  `correct_answer` json DEFAULT NULL,
  `explanation` text,
  `points` decimal(5,2) NOT NULL,
  `order` int(11) NOT NULL,
  `time_limit` int(11) DEFAULT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `time_limit_seconds` int(11) DEFAULT NULL COMMENT 'Time limit for this specific question in seconds',
  `created_by` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `quiz_questions`
--

INSERT INTO `quiz_questions` (`id`, `quiz_id`, `question_type`, `question_text`, `question_data`, `correct_answer`, `explanation`, `points`, `order`, `time_limit`, `is_required`, `created_at`, `updated_at`, `time_limit_seconds`, `created_by`) VALUES
(1, 1, 'single_choice', 'Choose correct answer', '{\"options\": [\"This is the stesp1\", \"This is the stesp2\", \"This is ok\"], \"correct_option_index\": 1}', NULL, 'Ok', '1.00', 2, 20000, 1, '2025-10-25 16:22:09', '2025-10-27 12:38:30', 180, 0),
(2, 1, 'matching', 'Match correct item for correspondance', '{\"left_items\": [{\"id\": \"1\", \"text\": \"Input components\"}, {\"id\": \"2\", \"text\": \"Output components\"}], \"right_items\": [{\"id\": \"1\", \"text\": \"Forms\"}, {\"id\": \"2\", \"text\": \"Labels\"}], \"correct_matches\": {\"1\": \"1\", \"2\": \"2\"}}', NULL, 'This is the question ', '1.00', 3, 20000, 1, '2025-10-26 09:44:38', '2025-10-27 12:38:30', 180, 0),
(3, 1, 'coding', 'sdfsdfassdafsdafafasd', '{\"language\": \"java\", \"test_cases\": [{\"id\": \"1\", \"input\": \"sdaf\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"asdf\"}], \"starter_code\": \"public int fibonacci(int n) {\\n    // Your solution here\\n}\"}', NULL, '', '1.00', 1, 20000, 1, '2025-10-26 15:32:43', '2025-10-27 12:38:30', 180, 0),
(4, 1, 'coding', 'Design your portifolio using HTML', '{\"language\": \"html\", \"test_cases\": [{\"id\": \"1\", \"input\": \"Ok\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"Ok\"}], \"starter_code\": \"<nav>\\n    <ul>\\n        <li><a href=\\\"/\\\">Home</a></li>\\n        <li><a href=\\\"/about\\\">About</a></li>\\n        <li><a href=\\\"/services\\\">Services</a></li>\\n        <li><a href=\\\"/contact\\\">Contact</a></li>\\n    </ul>\\n</nav>\"}', NULL, NULL, '1.00', 4, 20000, 1, '2025-10-26 15:42:11', '2025-10-27 12:38:30', 180, 0),
(5, 1, 'coding', 'Work on the following scenario', '{\"language\": \"react\", \"test_cases\": [{\"id\": \"1\", \"input\": \"234\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"324234\"}], \"constraints\": \"This is the contraints\", \"starter_code\": \"import React, { useState, useEffect } from \'react\';\\n\\nfunction Counter() {\\n    const [count, setCount] = useState(0);\\n    \\n    useEffect(() => {\\n        document.title = `Count: ${count}`;\\n    }, [count]);\\n    \\n    return (\\n        <div>\\n            <h1>{count}</h1>\\n            <button onClick={() => setCount(count + 1)}>\\n                Increment\\n            </button>\\n        </div>\\n    );\\n}\\n\\nexport default Counter;\"}', NULL, 'Work on this assignment', '1.00', 5, 20000, 1, '2025-10-27 14:23:03', '2025-10-27 14:23:03', 180, 0),
(6, 2, 'coding', 'Calculate nth Fibonacci number', '{\"language\": \"javascript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"2\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"23\"}], \"constraints\": \"This is the the contrains\", \"starter_code\": \"function fibonacci(n) {\\n  // Your solution here\\n}\"}', NULL, 'The explaination here', '5.00', 1, 20000, 1, '2025-10-27 15:06:06', '2025-10-27 15:06:06', 180, 0),
(7, 2, 'single_choice', 'This is the testing other question', '{\"options\": [\"Option 1\", \"Option 2\"], \"correct_option_index\": 1}', NULL, 'This is the explaination', '5.00', 2, 20000, 1, '2025-10-27 15:07:05', '2025-10-27 15:07:05', 180, 0),
(8, 2, 'matching', 'This is matching question', '{\"left_items\": [{\"id\": \"1\", \"text\": \"Term 1\"}, {\"id\": \"2\", \"text\": \"Term 2\"}], \"right_items\": [{\"id\": \"1\", \"text\": \"Def 1\"}, {\"id\": \"2\", \"text\": \"Def 2\"}], \"correct_matches\": {\"1\": \"2\", \"2\": \"1\"}}', NULL, 'This is the xpla', '10.00', 3, 20000, 1, '2025-10-27 15:07:46', '2025-10-27 15:07:46', 180, 0),
(9, 4, 'multiple_choice', 'What is the correct way to declare a variable in JavaScript?', '{\"options\": [\"variable x = 5;\", \"var x = 5;\", \"v x = 5;\", \"declare x = 5;\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [1]}', '{\"correct_option_indices\": [1]}', 'The var keyword is used to declare variables in JavaScript.', '10.00', 1, 20000, 1, '2025-10-27 17:22:47', '2025-10-27 17:22:47', 180, 0),
(10, 4, 'multiple_choice', 'Which of the following is NOT a JavaScript data type?', '{\"options\": [\"string\", \"number\", \"boolean\", \"character\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [3]}', '{\"correct_option_indices\": [3]}', 'JavaScript does not have a character data type. It uses strings for text.', '10.00', 2, 20000, 1, '2025-10-27 17:22:47', '2025-10-27 17:22:47', 180, 0),
(11, 5, 'multiple_choice', 'What does HTML stand for?', '{\"options\": [\"Hypertext Markup Language\", \"High Tech Modern Language\", \"Home Tool Markup Language\", \"Hyperlink and Text Markup Language\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [0]}', '{\"correct_option_indices\": [0]}', 'HTML stands for Hypertext Markup Language.', '15.00', 1, 20000, 1, '2025-10-27 17:22:47', '2025-10-27 17:22:47', 180, 0),
(12, 5, 'multiple_choice', 'Which CSS property is used to change the text color?', '{\"options\": [\"font-color\", \"text-color\", \"color\", \"foreground-color\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [2]}', '{\"correct_option_indices\": [2]}', 'The color property is used to set the color of text.', '15.00', 2, 20000, 1, '2025-10-27 17:22:47', '2025-10-27 17:22:47', 180, 0),
(13, 5, 'multiple_choice', 'What is the purpose of CSS in web development?', '{\"options\": [\"To structure web pages\", \"To style web pages\", \"To add interactivity\", \"To connect to databases\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [1]}', '{\"correct_option_indices\": [1]}', 'CSS (Cascading Style Sheets) is used to describe the presentation of a document written in HTML.', '20.00', 3, 20000, 1, '2025-10-27 17:22:47', '2025-10-27 17:22:47', 180, 0),
(14, 6, 'multiple_choice', 'What is the correct way to declare a variable in JavaScript?', '{\"options\": [\"variable x = 5;\", \"var x = 5;\", \"v x = 5;\", \"declare x = 5;\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [1]}', '{\"correct_option_indices\": [1]}', 'The var keyword is used to declare variables in JavaScript.', '10.00', 1, 20000, 1, '2025-10-27 17:29:57', '2025-10-27 17:29:57', 180, 0),
(15, 6, 'multiple_choice', 'Which of the following is NOT a JavaScript data type?', '{\"options\": [\"string\", \"number\", \"boolean\", \"character\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [3]}', '{\"correct_option_indices\": [3]}', 'JavaScript does not have a character data type. It uses strings for text.', '10.00', 2, 20000, 1, '2025-10-27 17:29:57', '2025-10-27 17:29:57', 180, 0),
(16, 7, 'multiple_choice', 'What does HTML stand for?', '{\"options\": [\"Hypertext Markup Language\", \"High Tech Modern Language\", \"Home Tool Markup Language\", \"Hyperlink and Text Markup Language\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [0]}', '{\"correct_option_indices\": [0]}', 'HTML stands for Hypertext Markup Language.', '15.00', 1, 20000, 1, '2025-10-27 17:29:57', '2025-10-27 17:29:57', 180, 0),
(17, 7, 'multiple_choice', 'Which CSS property is used to change the text color?', '{\"options\": [\"font-color\", \"text-color\", \"color\", \"foreground-color\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [2]}', '{\"correct_option_indices\": [2]}', 'The color property is used to set the color of text.', '15.00', 2, 20000, 1, '2025-10-27 17:29:57', '2025-10-27 17:29:57', 180, 0),
(18, 7, 'multiple_choice', 'What is the purpose of CSS in web development?', '{\"options\": [\"To structure web pages\", \"To style web pages\", \"To add interactivity\", \"To connect to databases\"], \"max_selections\": 1, \"min_selections\": 1, \"correct_option_indices\": [1]}', '{\"correct_option_indices\": [1]}', 'CSS (Cascading Style Sheets) is used to describe the presentation of a document written in HTML.', '20.00', 3, 20000, 1, '2025-10-27 17:29:57', '2025-10-27 17:29:57', 180, 0),
(19, 6, 'coding', 'This coding question for testing', '{\"language\": \"javascript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"Ok\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"Ok\"}], \"constraints\": \"This is the instruction\", \"starter_code\": \"function isPalindrome(str) {\\n  // Your solution here\\n}\"}', NULL, 'This is the explaination', '5.00', 3, 20000, 1, '2025-11-03 16:14:44', '2025-11-03 16:14:44', 180, 0),
(20, 3, 'coding', 'This is the other testing question for coding', '{\"language\": \"javascript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"This is ok\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"This is ok\"}], \"constraints\": \"This is good contraint here\", \"starter_code\": \"function twoSum(nums, target) {\\n  // Your solution here\\n}\"}', NULL, 'This is the explaination', '5.00', 1, 20000, 1, '2025-11-03 16:16:02', '2025-11-03 16:16:02', 180, 0),
(21, 3, 'coding', 'Write a program that prints the first n numbers in the Fibonacci sequence.\nThe Fibonacci sequence starts with 0 and 1, and each subsequent number is the sum of the two preceding ones.\nMathematically:\nF(0) = 0\nF(1) = 1\nF(n) = F(n-1) + F(n-2), for n ≥ 2', '{\"language\": \"javascript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"5\", \"points\": 10, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"5\"}, {\"id\": \"2\", \"input\": \"10\", \"points\": 15, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"55\"}, {\"id\": \"3\", \"input\": \"0\", \"points\": 10, \"is_hidden\": true, \"time_limit\": 5000, \"expected_output\": \"0\"}, {\"id\": \"4\", \"input\": \"20\", \"points\": 15, \"is_hidden\": true, \"time_limit\": 5000, \"expected_output\": \"6765\"}], \"constraints\": \"You must write clean, well-commented code in your preferred programming language (Python, C++, Java, or JavaScript).\\nThe program must:\\nTake an integer input n from the user.\\nValidate the input (must be a positive integer greater than 1).\\n\\nDisplay the sequence in one line separated by spaces.\\n\\nInclude both an iterative and a recursive approach (two functions).\\n\\nClearly print labels like:\\n\\nIterative Fibonacci:\\n0 1 1 2 3 5 8\\n\\nRecursive Fibonacci:\\n0 1 1 2 3 5 8\\n\\nHandle invalid inputs gracefully (e.g., display an error message if the user enters text or a negative number).\\nYou must include comments explaining:\\nBase case(s)\\nRecursive relation\\nTime and space complexity\", \"starter_code\": \"function fibonacci(n) {\\n  // Your solution here\\n}\"}', NULL, 'This is the testing question', '5.00', 2, 20000, 1, '2025-11-03 22:09:01', '2025-11-03 22:09:01', 180, 0),
(22, 8, 'coding', 'Write a function named fibonacci(n) that returns the nth Fibonacci number.\nThe Fibonacci sequence is defined as follows:\n\nF(0) = 0  \nF(1) = 1  \nF(n) = F(n - 1) + F(n - 2)  for n > 1\n\nExample of the sequence:\n0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, ...', '{\"language\": \"javascript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"5\", \"points\": 10, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"5\"}, {\"id\": \"2\", \"input\": \"10\", \"points\": 15, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"55\"}, {\"id\": \"3\", \"input\": \"0\", \"points\": 10, \"is_hidden\": true, \"time_limit\": 5000, \"expected_output\": \"0\"}, {\"id\": \"4\", \"input\": \"20\", \"points\": 15, \"is_hidden\": true, \"time_limit\": 5000, \"expected_output\": \"6765\"}], \"constraints\": \"Implement your function in JavaScript as follows:\\n\\nfunction fibonacci(n) {\\n  // Your solution here\\n}\\n\\n- Do not use recursion for this task. Use a loop-based (iterative) approach.\\n- Ensure your solution works efficiently for large values of n (up to 50).\", \"starter_code\": \"function fibonacci(n) {\\n  // Your solution here\\n}\"}', NULL, 'This is the explaination', '5.00', 1, 20000, 1, '2025-11-04 13:30:09', '2025-11-04 13:30:09', 180, 0),
(23, 9, 'coding', 'You are given an array of integers nums where every element appears twice, except for one element which appears only once.\nWrite a TypeScript function that returns the single element that appears once.\n\nYou must implement a TypeScript function that:\n\nTakes an array of numbers as input.\n\nReturns the number that appears only once.\n\nFunction Signature:\nfunction findUnique(nums: number[]): number;', '{\"language\": \"typescript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"console.log(findUnique([2, 2, 1]));\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"1\"}, {\"id\": \"2\", \"input\": \"console.log(findUnique([4, 1, 2, 1, 2]));\", \"points\": 10, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"4\"}, {\"id\": \"3\", \"input\": \"console.log(findUnique([7]));\", \"points\": 10, \"is_hidden\": false, \"time_limit\": 5000, \"expected_output\": \"7\"}], \"constraints\": \"a) 1 <= nums.length <= 10^5\\n\\nb) -10^5 <= nums[i] <= 10^5\\n\\nc) Each element appears exactly twice except for one element.\", \"starter_code\": \"interface User {\\n  id: number;\\n  name: string;\\n  email: string;\\n  isActive: boolean;\\n}\\n\\nfunction createUser(name: string, email: string): User {\\n  return {\\n    id: Math.floor(Math.random() * 1000),\\n    name,\\n    email,\\n    isActive: true\\n  }\\n}\\n\\nconst user = createUser(\'John Doe\', \'john@example.com\')\\nconsole.log(user)\"}', NULL, NULL, '1.00', 1, NULL, 1, '2025-11-07 18:52:06', '2025-11-07 18:52:06', 320, 0),
(42, 13, 'single_choice', 'What is the capital of France?', '{\"options\": [\"London\", \"Berlin\", \"Paris\", \"Madrid\"], \"correct_option_index\": 2}', NULL, 'Paris is the capital and most populous city of France.', '10.00', 1, NULL, 1, '2025-11-25 22:27:35', '2025-11-25 22:27:35', NULL, 1),
(43, 13, 'multiple_choice', 'Which of the following are programming languages?', '{\"options\": [\"Python\", \"HTML\", \"JavaScript\", \"CSS\"], \"max_selections\": 4, \"min_selections\": 1, \"correct_option_indices\": [0, 2]}', NULL, 'Python and JavaScript are programming languages, while HTML and CSS are markup and styling languages.', '15.00', 2, NULL, 1, '2025-11-25 22:27:35', '2025-11-25 22:27:35', NULL, 1),
(44, 13, 'true_false', 'The Earth is flat.', '{\"correct_answer\": false}', NULL, 'Scientific evidence shows that the Earth is an oblate spheroid.', '5.00', 3, NULL, 1, '2025-11-25 22:27:35', '2025-11-25 22:27:35', NULL, 1),
(45, 13, 'numerical', 'What is 15 + 27?', '{\"tolerance\": 0, \"correct_answer\": 42}', NULL, '15 + 27 = 42', '10.00', 4, NULL, 1, '2025-11-25 22:27:35', '2025-11-25 22:27:35', NULL, 1),
(46, 13, 'numerical', 'Calculate the area of a circle with radius 5. Use π ≈ 3.14159.', '{\"units\": \"square units\", \"tolerance\": 0.1, \"correct_answer\": 78.54}', NULL, 'Area = πr² = 3.14159 × 5² = 3.14159 × 25 = 78.53975 ≈ 78.54', '15.00', 5, NULL, 1, '2025-11-25 22:27:35', '2025-11-25 22:27:35', NULL, 1),
(47, 13, 'fill_blank', 'Complete the sentence: The quick brown ___ jumps over the lazy dog.', '{\"acceptable_answers\": [{\"answers\": [\"fox\"], \"case_sensitive\": false}]}', NULL, 'The classic pangram sentence uses \"fox\".', '10.00', 6, NULL, 1, '2025-11-25 22:27:35', '2025-11-25 22:27:35', NULL, 1),
(48, 13, 'matching', 'Match the programming languages with their creators.', '{\"left_items\": [{\"id\": \"1\", \"text\": \"Python\"}, {\"id\": \"2\", \"text\": \"JavaScript\"}, {\"id\": \"3\", \"text\": \"Java\"}], \"right_items\": [{\"id\": \"1\", \"text\": \"Guido van Rossum\"}, {\"id\": \"2\", \"text\": \"Brendan Eich\"}, {\"id\": \"3\", \"text\": \"James Gosling\"}], \"correct_matches\": {\"1\": \"1\", \"2\": \"2\", \"3\": \"3\"}}', NULL, 'Python was created by Guido van Rossum, JavaScript by Brendan Eich, and Java by James Gosling.', '20.00', 7, NULL, 1, '2025-11-25 22:27:35', '2025-11-25 22:27:35', NULL, 1),
(49, 13, 'ordering', 'Order the steps of the software development lifecycle.', '{\"items\": [{\"id\": \"1\", \"text\": \"Planning\", \"order\": 1}, {\"id\": \"2\", \"text\": \"Design\", \"order\": 2}, {\"id\": \"3\", \"text\": \"Implementation\", \"order\": 3}, {\"id\": \"4\", \"text\": \"Testing\", \"order\": 4}, {\"id\": \"5\", \"text\": \"Deployment\", \"order\": 5}]}', NULL, 'The typical SDLC order is: Planning → Design → Implementation → Testing → Deployment.', '15.00', 8, NULL, 1, '2025-11-25 22:27:35', '2025-11-25 22:27:35', NULL, 1),
(50, 13, 'dropdown', 'Select the correct HTML tag for creating a hyperlink.', '{\"dropdown_options\": [{\"text\": \"Choose the correct tag\", \"options\": [\"<div>\", \"<a>\", \"<p>\", \"<span>\"]}]}', '[{\"dropdown_index\": 0, \"selected_option\": \"<a>\"}]', 'The <a> tag defines a hyperlink in HTML.', '10.00', 9, NULL, 1, '2025-11-25 22:27:35', '2025-11-25 22:27:35', NULL, 1),
(51, 13, 'coding', 'Write a function that returns the sum of two numbers.', '{\"language\": \"javascript\", \"test_cases\": [{\"id\": \"1\", \"input\": \"5, 3\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"8\"}, {\"id\": \"2\", \"input\": \"-1, 1\", \"points\": 10, \"is_hidden\": false, \"expected_output\": \"0\"}, {\"id\": \"3\", \"input\": \"0, 0\", \"points\": 10, \"is_hidden\": true, \"expected_output\": \"0\"}], \"constraints\": \"Write a function named sum that takes two parameters and returns their sum.\"}', NULL, 'A simple function that adds two numbers together.', '25.00', 10, NULL, 1, '2025-11-25 22:27:35', '2025-11-25 22:27:35', NULL, 1),
(52, 13, 'short_answer', 'What are the main benefits of using version control systems?', '{\"keywords\": [\"collaboration\", \"history\", \"backup\", \"branching\"], \"max_length\": 500, \"min_length\": 20}', NULL, 'Version control systems provide collaboration, maintain history, serve as backup, and enable branching.', '15.00', 11, NULL, 1, '2025-11-25 22:27:35', '2025-11-25 22:27:35', NULL, 1),
(53, 14, 'single_choice', 'A client gives unclear feedback on a website design. What’s your first step?', '{\"options\": [\"Make immediate changes you think they want\", \"Ask clarifying questions before proceeding ✅\", \"Wait for further feedback\", \"Disregard their comments\"], \"correct_option_index\": 1}', NULL, NULL, '2.00', 1, NULL, 1, '2025-11-25 21:12:42', '2025-11-25 21:12:42', 60, 1),
(54, 14, 'single_choice', 'You’re given a new project with a tight deadline and minimal documentation. What do you do?', '{\"options\": [\"Start coding right away\", \"Build based on similar past projects\", \"Clarify project goals and requirements ✅\", \"Ask for deadline extension immediately\"], \"correct_option_index\": 2}', NULL, NULL, '2.00', 2, NULL, 1, '2025-11-25 21:13:25', '2025-11-25 21:13:25', 60, 1),
(55, 14, 'single_choice', 'A website looks perfect on desktop but breaks on mobile. What’s the best next step?', '{\"options\": [\"Blame the framework\", \"Ask the designer to fix it\", \"Leave it since mobile isn’t critical\", \"Test and debug responsive design ✅\"], \"correct_option_index\": 3}', NULL, NULL, '2.00', 3, NULL, 1, '2025-11-25 21:14:34', '2025-11-25 21:14:34', 60, 1),
(56, 14, 'multiple_choice', 'Which of the following reflect good debugging practices?', '{\"options\": [\"Reproduce the issue\", \"Check browser console logs\", \"Make random changes hoping it fixes\", \"Test in multiple environments\", \"None of above\"], \"correct_option_indices\": [0, 1, 3]}', NULL, NULL, '2.00', 4, NULL, 1, '2025-11-25 21:15:57', '2025-11-25 21:15:57', 60, 1),
(57, 14, 'true_false', 'It’s acceptable to deploy code that passes most tests but has known bugs if the deadline is close', '{\"correct_answer\": false}', NULL, NULL, '2.00', 5, NULL, 1, '2025-11-25 21:17:01', '2025-11-25 21:17:01', 60, 1);

-- --------------------------------------------------------

--
-- Table structure for table `quiz_submissions`
--

CREATE TABLE `quiz_submissions` (
  `id` int(11) NOT NULL,
  `quiz_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `total_score` decimal(8,2) NOT NULL,
  `max_score` decimal(8,2) NOT NULL,
  `percentage` decimal(5,2) NOT NULL,
  `status` enum('in_progress','completed','timed_out','abandoned') NOT NULL DEFAULT 'in_progress',
  `grade_status` enum('pending','graded','auto_graded') NOT NULL DEFAULT 'pending',
  `time_taken` int(11) NOT NULL,
  `started_at` datetime NOT NULL,
  `completed_at` datetime DEFAULT NULL,
  `graded_at` datetime DEFAULT NULL,
  `graded_by` int(11) DEFAULT NULL,
  `feedback` text,
  `passed` tinyint(1) NOT NULL,
  `attempt_number` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL COMMENT 'Calculated end time based on quiz duration'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `quiz_submissions`
--

INSERT INTO `quiz_submissions` (`id`, `quiz_id`, `student_id`, `total_score`, `max_score`, `percentage`, `status`, `grade_status`, `time_taken`, `started_at`, `completed_at`, `graded_at`, `graded_by`, `feedback`, `passed`, `attempt_number`, `created_at`, `updated_at`, `end_time`) VALUES
(44, 14, 3, '0.00', '10.00', '0.00', 'completed', 'auto_graded', 16079, '2025-11-25 21:58:15', '2025-11-25 21:58:31', NULL, NULL, NULL, 0, 1, '2025-11-25 21:58:15', '2025-11-25 21:58:31', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `submissions`
--

CREATE TABLE `submissions` (
  `id` int(11) NOT NULL,
  `assignment_id` int(11) DEFAULT NULL,
  `student_id` int(11) DEFAULT NULL,
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
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `submissions`
--

INSERT INTO `submissions` (`id`, `assignment_id`, `student_id`, `status`, `submitted_at`, `text_submission`, `file_submissions`, `grade`, `feedback`, `resubmissions`, `is_late`, `comments`, `created_at`, `updated_at`) VALUES
(1, 1, 3, 'graded', '2025-10-21 17:37:17', 'This is the submission', '[{\"filename\":\"Archive (2).zip\",\"originalname\":\"Archive (2).zip\",\"path\":\"/Users/m2pro/dev/projects/AI PROJECTS/NGA-Projects/spwms/server/uploads/file_submission-1761068237753-891925332.zip\",\"size\":146284,\"mimetype\":\"application/zip\"}]', '80/100', 'ok', '[]', 0, '[]', '2025-10-21 17:37:17', '2025-10-23 14:30:29');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('student','instructor','admin') NOT NULL DEFAULT 'student',
  `profile_image` varchar(255) DEFAULT NULL,
  `reset_password_token` varchar(255) DEFAULT NULL,
  `reset_password_expire` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `password`, `role`, `profile_image`, `reset_password_token`, `reset_password_expire`, `created_at`, `updated_at`) VALUES
(1, 'Niyongabo', 'Emmanuel', 'emmanuelniyongabo44@gmail.com', '$2a$10$K3QdagXt7nkZFEnSNET8x.rciv8mgedl8xPbVHv5RXGwKORje.0r.', 'instructor', 'profile-1-1763144624263-328190628.png', NULL, NULL, '2025-10-20 11:14:00', '2025-11-14 18:23:44'),
(2, 'ISHIMWE', 'Keny kelvin', 'ikennykelvin75@gmail.com', '$2a$10$2nohspCj/oqTN9.4fS28Mu21bkbb57qtAudArO/v1.hMN/91WXhk.', 'student', NULL, NULL, NULL, '2025-10-20 11:55:50', '2025-10-20 11:55:50'),
(3, 'Doe', 'John', 'johndoe@gmail.com', '$2a$10$Hdr15vHryzSDm8nIkRvXZeG18AxGCHAIM3CW8lE7AaNhx1vFewmRq', 'student', 'profile-3-1761291718198-707527274.png', NULL, NULL, '2025-10-20 13:54:42', '2025-10-24 07:41:58'),
(4, 'HIRWA', 'Brian', 'bhirwa344@gmail.com', '$2a$10$Hdr15vHryzSDm8nIkRvXZeG18AxGCHAIM3CW8lE7AaNhx1vFewmRq', 'student', NULL, NULL, NULL, '2025-10-20 14:17:50', '2025-10-20 14:17:50'),
(5, 'Tuyishimire', 'Eric', 'tuyishimireericc@gmail.com', '$2a$10$d4KUZxO96S4OZzCpmlhfveH8gHUopm/6um5MEEFfZWLExOoTmqRdi', 'instructor', NULL, NULL, NULL, '2025-10-20 14:28:30', '2025-10-20 14:28:30'),
(6, 'Utuje Oceanne', 'Camilla', 'utujeocean@gmail.com', '$2a$10$ZIIFeIkOn5c/NPOtnPlbk.bw9BghNX55Ld/nBaPdtg41jseOOfp6S', 'student', NULL, NULL, NULL, '2025-10-20 17:26:20', '2025-10-20 17:26:20'),
(7, 'Levi', 'Gatimu', 'getmorelev@gmail.com', '$2a$10$1aNshK8NJLE7QOneHcJMC.RcXXYAWC0T.2plQrglCj.DV7osSZPaG', 'student', NULL, NULL, NULL, '2025-10-20 18:25:38', '2025-10-20 18:25:38'),
(8, 'TUNGA', 'Tiana', 'tianatunga@gmail.com', '$2a$10$czm6/VJEB0JnL7JzTZTBPu6ADQQMKBDIKRb6SjO9jqN65X8BjvRRK', 'student', NULL, NULL, NULL, '2025-10-21 05:33:34', '2025-10-21 05:33:34'),
(9, 'Isaro', 'Deborah', 'isarodeborah85@gmail.com', '$2a$10$fpUFmCJTqCGtHTdmkN4TzO7x5f4PeKtOm6PJLjqtRrdiOLbX0J75.', 'student', NULL, NULL, NULL, '2025-10-21 05:43:33', '2025-10-21 05:43:33'),
(10, 'Kheilla', 'Vera', 'cyusagisa12@gmail.com', '$2a$10$gyBrrzWwnPSyBj.i35BcTeRfg7nsk3WHGbBPDVg2KHoY8lllM3qWK', 'student', NULL, NULL, NULL, '2025-10-21 05:44:48', '2025-10-21 05:44:48'),
(11, 'Test', 'Instructor', 'instructor@example.com', '$2a$10$l3pMbByOpjy4xQ2IqQ6V0ejPxOArb1bstyTgFYfczRIodZ8lZB962', 'instructor', NULL, NULL, NULL, '2025-11-07 20:17:59', '2025-11-07 20:17:59');

-- --------------------------------------------------------

--
-- Table structure for table `user_courses`
--

CREATE TABLE `user_courses` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `enrollment_date` datetime NOT NULL,
  `completion_date` datetime DEFAULT NULL,
  `status` enum('enrolled','completed','dropped') NOT NULL DEFAULT 'enrolled',
  `grade` varchar(2) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `user_courses`
--

INSERT INTO `user_courses` (`id`, `user_id`, `course_id`, `enrollment_date`, `completion_date`, `status`, `grade`, `created_at`, `updated_at`) VALUES
(1, 3, 1, '2025-10-20 13:56:25', NULL, 'enrolled', NULL, '2025-10-20 13:56:25', '2025-10-20 18:12:46'),
(2, 4, 1, '2025-10-20 14:34:54', NULL, 'enrolled', NULL, '2025-10-20 14:34:54', '2025-10-20 14:34:54'),
(3, 2, 1, '2025-10-20 14:34:54', NULL, 'enrolled', NULL, '2025-10-20 14:34:54', '2025-10-20 14:34:54'),
(4, 6, 1, '2025-10-20 18:09:13', NULL, 'enrolled', NULL, '2025-10-20 18:09:13', '2025-10-20 18:09:13'),
(5, 7, 1, '2025-10-20 18:32:51', NULL, 'enrolled', NULL, '2025-10-20 18:32:51', '2025-10-20 18:32:51'),
(6, 8, 1, '2025-10-21 08:01:31', NULL, 'enrolled', NULL, '2025-10-21 08:01:31', '2025-10-21 08:01:31'),
(7, 10, 1, '2025-10-21 08:01:31', NULL, 'enrolled', NULL, '2025-10-21 08:01:31', '2025-10-21 08:01:31'),
(8, 9, 1, '2025-10-21 08:01:31', NULL, 'enrolled', NULL, '2025-10-21 08:01:31', '2025-10-21 08:01:31'),
(11, 9, 2, '2025-10-25 10:33:19', NULL, 'enrolled', NULL, '2025-10-25 10:33:19', '2025-10-25 10:33:19'),
(12, 4, 2, '2025-10-25 10:49:53', NULL, 'enrolled', NULL, '2025-10-25 10:49:53', '2025-10-25 10:49:53'),
(13, 3, 2, '2025-10-26 15:45:29', NULL, 'enrolled', NULL, '2025-10-26 15:45:29', '2025-10-26 15:45:29');

-- --------------------------------------------------------

--
-- Structure for view `question_difficulty`
--
DROP TABLE IF EXISTS `question_difficulty`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `question_difficulty`  AS SELECT `qq`.`id` AS `question_id`, `qq`.`quiz_id` AS `quiz_id`, `qq`.`question_type` AS `question_type`, `qq`.`points` AS `points`, count(`qa`.`id`) AS `total_attempts`, count((case when (`qa`.`is_correct` = 1) then 1 end)) AS `correct_attempts`, (case when (count(`qa`.`id`) > 0) then ((count((case when (`qa`.`is_correct` = 1) then 1 end)) / count(`qa`.`id`)) * 100) else 0 end) AS `success_rate`, avg(`qa`.`points_earned`) AS `average_points_earned`, avg(`qa`.`time_taken`) AS `average_time_seconds` FROM (`quiz_questions` `qq` left join `quiz_attempts` `qa` on((`qq`.`id` = `qa`.`question_id`))) GROUP BY `qq`.`id`, `qq`.`quiz_id`, `qq`.`question_type`, `qq`.`points``points`  ;

-- --------------------------------------------------------

--
-- Structure for view `quiz_analytics`
--
DROP TABLE IF EXISTS `quiz_analytics`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `quiz_analytics`  AS SELECT `q`.`id` AS `quiz_id`, `q`.`title` AS `title`, `q`.`course_id` AS `course_id`, count(`qs`.`id`) AS `total_submissions`, avg(`qs`.`percentage`) AS `average_score`, avg((`qs`.`time_taken` / 60)) AS `average_time_minutes`, ((sum((case when `qs`.`passed` then 1 else 0 end)) / count(`qs`.`id`)) * 100) AS `pass_rate`, count((case when (`qs`.`status` = 'completed') then 1 end)) AS `completed_submissions`, count((case when (`qs`.`grade_status` = 'graded') then 1 end)) AS `graded_submissions` FROM (`quizzes` `q` left join `quiz_submissions` `qs` on((`q`.`id` = `qs`.`quiz_id`))) GROUP BY `q`.`id`, `q`.`title`, `q`.`course_id``course_id`  ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `assignments`
--
ALTER TABLE `assignments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `course_id` (`course_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `courses`
--
ALTER TABLE `courses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `courses_code_unique` (`code`),
  ADD KEY `instructor_id` (`instructor_id`);

--
-- Indexes for table `proctoring_events`
--
ALTER TABLE `proctoring_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `session_id` (`session_id`),
  ADD KEY `timestamp` (`timestamp`),
  ADD KEY `severity` (`severity`),
  ADD KEY `reviewed_by` (`reviewed_by`),
  ADD KEY `idx_proctoring_events_session_id` (`session_id`),
  ADD KEY `idx_proctoring_events_timestamp` (`timestamp`),
  ADD KEY `idx_proctoring_events_severity` (`severity`);

--
-- Indexes for table `proctoring_sessions`
--
ALTER TABLE `proctoring_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `session_token` (`session_token`),
  ADD KEY `quiz_id` (`quiz_id`),
  ADD KEY `student_id` (`student_id`),
  ADD KEY `proctor_id` (`proctor_id`),
  ADD KEY `status` (`status`),
  ADD KEY `start_time` (`start_time`),
  ADD KEY `idx_proctoring_sessions_session_token` (`session_token`),
  ADD KEY `idx_proctoring_sessions_quiz_id` (`quiz_id`),
  ADD KEY `idx_proctoring_sessions_student_id` (`student_id`),
  ADD KEY `idx_proctoring_sessions_status` (`status`),
  ADD KEY `idx_proctoring_sessions_start_time` (`start_time`);

--
-- Indexes for table `proctoring_settings`
--
ALTER TABLE `proctoring_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `quiz_id` (`quiz_id`),
  ADD KEY `enabled` (`enabled`),
  ADD KEY `idx_proctoring_settings_quiz_id` (`quiz_id`),
  ADD KEY `idx_proctoring_settings_enabled` (`enabled`);

--
-- Indexes for table `quizzes`
--
ALTER TABLE `quizzes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `course_id` (`course_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_quizzes_is_public` (`is_public`),
  ADD KEY `idx_quizzes_status_public` (`status`,`is_public`);

--
-- Indexes for table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `question_id` (`question_id`),
  ADD KEY `student_id` (`student_id`),
  ADD KEY `submission_id` (`submission_id`),
  ADD KEY `idx_quiz_attempts_quiz_question_student` (`quiz_id`,`question_id`,`student_id`);

--
-- Indexes for table `quiz_questions`
--
ALTER TABLE `quiz_questions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_quiz_questions_quiz_order` (`quiz_id`,`order`);

--
-- Indexes for table `quiz_submissions`
--
ALTER TABLE `quiz_submissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_student_quiz_attempt` (`student_id`,`quiz_id`,`attempt_number`),
  ADD KEY `quiz_id` (`quiz_id`),
  ADD KEY `graded_by` (`graded_by`),
  ADD KEY `idx_quiz_submissions_student_quiz_status` (`student_id`,`quiz_id`,`status`);

--
-- Indexes for table `submissions`
--
ALTER TABLE `submissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_assignment_student` (`assignment_id`,`student_id`),
  ADD KEY `submissions_student_id` (`student_id`),
  ADD KEY `submissions_assignment_id` (`assignment_id`),
  ADD KEY `submissions_status` (`status`),
  ADD KEY `submissions_submitted_at` (`submitted_at`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `email_2` (`email`),
  ADD UNIQUE KEY `email_3` (`email`),
  ADD UNIQUE KEY `email_4` (`email`),
  ADD UNIQUE KEY `email_5` (`email`),
  ADD UNIQUE KEY `email_6` (`email`),
  ADD UNIQUE KEY `email_7` (`email`),
  ADD UNIQUE KEY `email_8` (`email`),
  ADD UNIQUE KEY `email_9` (`email`),
  ADD UNIQUE KEY `email_10` (`email`),
  ADD UNIQUE KEY `email_11` (`email`),
  ADD UNIQUE KEY `email_12` (`email`),
  ADD UNIQUE KEY `email_13` (`email`),
  ADD UNIQUE KEY `email_14` (`email`),
  ADD UNIQUE KEY `email_15` (`email`),
  ADD UNIQUE KEY `email_16` (`email`),
  ADD UNIQUE KEY `email_17` (`email`),
  ADD UNIQUE KEY `email_18` (`email`),
  ADD UNIQUE KEY `email_19` (`email`),
  ADD UNIQUE KEY `email_20` (`email`),
  ADD UNIQUE KEY `email_21` (`email`),
  ADD UNIQUE KEY `email_22` (`email`),
  ADD UNIQUE KEY `email_23` (`email`),
  ADD UNIQUE KEY `email_24` (`email`),
  ADD UNIQUE KEY `email_25` (`email`),
  ADD UNIQUE KEY `email_26` (`email`),
  ADD UNIQUE KEY `email_27` (`email`),
  ADD UNIQUE KEY `email_28` (`email`),
  ADD UNIQUE KEY `email_29` (`email`),
  ADD UNIQUE KEY `email_30` (`email`),
  ADD UNIQUE KEY `email_31` (`email`),
  ADD UNIQUE KEY `email_32` (`email`),
  ADD UNIQUE KEY `email_33` (`email`),
  ADD UNIQUE KEY `email_34` (`email`),
  ADD UNIQUE KEY `email_35` (`email`),
  ADD UNIQUE KEY `email_36` (`email`),
  ADD UNIQUE KEY `email_37` (`email`),
  ADD UNIQUE KEY `email_38` (`email`),
  ADD UNIQUE KEY `email_39` (`email`),
  ADD UNIQUE KEY `email_40` (`email`),
  ADD UNIQUE KEY `email_41` (`email`),
  ADD UNIQUE KEY `email_42` (`email`),
  ADD UNIQUE KEY `email_43` (`email`),
  ADD UNIQUE KEY `email_44` (`email`),
  ADD UNIQUE KEY `email_45` (`email`),
  ADD UNIQUE KEY `email_46` (`email`),
  ADD UNIQUE KEY `email_47` (`email`),
  ADD UNIQUE KEY `email_48` (`email`),
  ADD UNIQUE KEY `email_49` (`email`),
  ADD UNIQUE KEY `email_50` (`email`),
  ADD UNIQUE KEY `email_51` (`email`),
  ADD UNIQUE KEY `email_52` (`email`),
  ADD UNIQUE KEY `email_53` (`email`),
  ADD UNIQUE KEY `email_54` (`email`),
  ADD UNIQUE KEY `email_55` (`email`),
  ADD UNIQUE KEY `email_56` (`email`),
  ADD UNIQUE KEY `email_57` (`email`),
  ADD UNIQUE KEY `email_58` (`email`),
  ADD UNIQUE KEY `email_59` (`email`),
  ADD UNIQUE KEY `email_60` (`email`),
  ADD UNIQUE KEY `email_61` (`email`),
  ADD UNIQUE KEY `email_62` (`email`),
  ADD UNIQUE KEY `email_63` (`email`);

--
-- Indexes for table `user_courses`
--
ALTER TABLE `user_courses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_courses_course_id_user_id_unique` (`user_id`,`course_id`),
  ADD UNIQUE KEY `unique_user_course` (`user_id`,`course_id`),
  ADD KEY `course_id` (`course_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `assignments`
--
ALTER TABLE `assignments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `courses`
--
ALTER TABLE `courses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `proctoring_events`
--
ALTER TABLE `proctoring_events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2867;

--
-- AUTO_INCREMENT for table `proctoring_sessions`
--
ALTER TABLE `proctoring_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `proctoring_settings`
--
ALTER TABLE `proctoring_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `quizzes`
--
ALTER TABLE `quizzes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `quiz_questions`
--
ALTER TABLE `quiz_questions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=58;

--
-- AUTO_INCREMENT for table `quiz_submissions`
--
ALTER TABLE `quiz_submissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=45;

--
-- AUTO_INCREMENT for table `submissions`
--
ALTER TABLE `submissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `user_courses`
--
ALTER TABLE `user_courses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `assignments`
--
ALTER TABLE `assignments`
  ADD CONSTRAINT `assignments_ibfk_117` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `assignments_ibfk_118` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `courses`
--
ALTER TABLE `courses`
  ADD CONSTRAINT `courses_ibfk_1` FOREIGN KEY (`instructor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `proctoring_events`
--
ALTER TABLE `proctoring_events`
  ADD CONSTRAINT `proctoring_events_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `proctoring_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `proctoring_events_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `proctoring_sessions`
--
ALTER TABLE `proctoring_sessions`
  ADD CONSTRAINT `proctoring_sessions_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `proctoring_sessions_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `proctoring_sessions_ibfk_3` FOREIGN KEY (`proctor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `proctoring_settings`
--
ALTER TABLE `proctoring_settings`
  ADD CONSTRAINT `proctoring_settings_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `quizzes`
--
ALTER TABLE `quizzes`
  ADD CONSTRAINT `quizzes_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `quizzes_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  ADD CONSTRAINT `quiz_attempts_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `quiz_attempts_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `quiz_questions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `quiz_attempts_ibfk_3` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `quiz_attempts_ibfk_4` FOREIGN KEY (`submission_id`) REFERENCES `quiz_submissions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `quiz_questions`
--
ALTER TABLE `quiz_questions`
  ADD CONSTRAINT `quiz_questions_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `quiz_submissions`
--
ALTER TABLE `quiz_submissions`
  ADD CONSTRAINT `quiz_submissions_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `quiz_submissions_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `quiz_submissions_ibfk_3` FOREIGN KEY (`graded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `submissions`
--
ALTER TABLE `submissions`
  ADD CONSTRAINT `submissions_ibfk_115` FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `submissions_ibfk_116` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user_courses`
--
ALTER TABLE `user_courses`
  ADD CONSTRAINT `user_courses_ibfk_115` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_courses_ibfk_116` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

# Online Proctoring System Documentation

## Overview

The SPWMS (Student Practical Work Management System) includes a comprehensive online proctoring system designed to ensure academic integrity during quiz assessments. This system provides automated monitoring, identity verification, and real-time behavioral analysis to detect and prevent academic dishonesty.

## Features

### Core Functionality

- **Identity Verification**: Photo capture and facial recognition setup
- **Environment Scanning**: Room and device verification
- **Real-time Monitoring**: Live video/audio/screen monitoring
- **Behavioral Analysis**: Detection of suspicious activities
- **Risk Assessment**: Dynamic risk scoring system
- **Automated Actions**: Session termination on high-risk detection
- **Analytics Dashboard**: Comprehensive reporting and export capabilities

### Security Features

- **Browser Lockdown**: Prevents tab switching, copy-paste, right-click
- **Screen Recording**: Optional screen capture during sessions
- **Audio Monitoring**: Detection of suspicious background noise
- **Network Monitoring**: IP address and location tracking
- **Device Verification**: System information collection

## System Architecture

### Database Tables

#### proctoring_sessions

Stores information about each proctoring session:

- Session metadata (start/end times, duration)
- Student and quiz identification
- Risk scores and flag counts
- Browser and system information
- Recording URLs and notes

#### proctoring_events

Logs all events during proctoring sessions:

- Event types (tab switches, face detection, etc.)
- Severity levels (low, medium, high, critical)
- Timestamps and descriptions
- Screenshots and video timestamps
- Review status and notes

#### proctoring_settings

Configurable settings for each quiz:

- Proctoring mode (automated, live, record & review)
- Monitoring features (video, audio, screen)
- Security restrictions (copy-paste prevention, etc.)
- Risk thresholds and alert settings
- Custom instructions for students

### API Endpoints

#### Session Management

- `POST /api/proctoring/sessions` - Create new proctoring session
- `GET /api/proctoring/sessions/:token` - Get session details
- `PUT /api/proctoring/sessions/:token` - Update session status
- `DELETE /api/proctoring/sessions/:token` - End session

#### Event Logging

- `POST /api/proctoring/events` - Log proctoring event
- `GET /api/proctoring/events?session_token=xxx` - Get session events

#### Settings Management

- `GET /api/proctoring/quizzes/:quizId/proctoring-settings` - Get quiz settings
- `POST /api/proctoring/quizzes/:quizId/proctoring-settings` - Create/update settings
- `PUT /api/proctoring/quizzes/:quizId/proctoring-settings` - Update settings

#### Analytics

- `GET /api/proctoring/quizzes/:quizId/analytics` - Get analytics data
- `GET /api/proctoring/quizzes/:quizId/analytics/export` - Export analytics report

#### WebSocket

- `ws://localhost:5001/api/proctoring/ws/session/:token` - Real-time monitoring

## Installation & Setup

### Database Setup

Run the provided SQL script to create the necessary tables:

```sql
-- Run the create-proctoring-tables.sql script in your MySQL database
source create-proctoring-tables.sql;
```

### Backend Setup

1. Ensure all proctoring models are imported in `src/models/index.ts`
2. Add proctoring routes to your Express app
3. Configure WebSocket server for real-time monitoring
4. Set up file storage for recordings and screenshots

### Frontend Setup

1. Import proctoring components in your quiz pages
2. Add proctoring setup flow before quiz start
3. Integrate monitoring overlay during quiz taking
4. Add analytics dashboard for instructors

## Usage Guide

### For Instructors

#### Enabling Proctoring for a Quiz

1. **Create/Edit Quiz**: Go to quiz creation or editing page
2. **Access Proctoring Settings**: Click on "Proctoring Settings" tab
3. **Configure Settings**:
   - Enable proctoring
   - Choose monitoring mode (automated/live/record & review)
   - Set security restrictions
   - Configure risk thresholds
   - Add custom instructions

#### Monitoring Active Sessions

1. **Access Dashboard**: Go to instructor dashboard
2. **View Active Sessions**: See real-time list of proctored quizzes
3. **Monitor Individual Sessions**: Click on session for detailed view
4. **Review Events**: Check flagged events and take action

#### Analytics and Reporting

1. **Access Analytics**: Go to quiz details page
2. **View Reports**: See risk distribution, common violations
3. **Export Data**: Download PDF reports for record-keeping
4. **Review Sessions**: Detailed session-by-session analysis

### For Students

#### Taking a Proctored Quiz

1. **Quiz Access**: Navigate to assigned quiz
2. **Proctoring Setup**: Complete identity verification and environment scan
3. **Quiz Start**: Begin quiz with monitoring active
4. **During Quiz**: Follow all instructions and avoid flagged behaviors
5. **Completion**: Submit quiz normally

#### Understanding Proctoring

- **Identity Verification**: Take a photo for facial recognition
- **Environment Scan**: Show room and ensure no unauthorized materials
- **Monitoring**: Video/audio/screen monitoring throughout quiz
- **Behavioral Rules**: No tab switching, copying, or suspicious activities

## Configuration Options

### Proctoring Modes

#### Automated Proctoring

- AI-powered monitoring with automatic flagging
- Real-time risk assessment
- Automated session termination on high risk

#### Live Proctoring

- Human proctor monitors session in real-time
- Direct communication with student
- Manual intervention capabilities

#### Record & Review

- All sessions recorded for later review
- No real-time intervention
- Post-session analysis and grading

### Security Settings

#### Browser Restrictions

- **Tab Switching Prevention**: Blocks navigation to other tabs
- **Copy-Paste Prevention**: Disables clipboard operations
- **Right-Click Prevention**: Blocks context menus
- **Window Minimization Prevention**: Keeps quiz window focused

#### Monitoring Features

- **Video Monitoring**: Webcam feed analysis
- **Audio Monitoring**: Microphone input analysis
- **Screen Recording**: Desktop screen capture
- **Face Detection**: Continuous facial recognition

### Risk Assessment

#### Risk Scoring

- **Low Risk (0-30)**: Normal behavior
- **Medium Risk (31-60)**: Some suspicious activity
- **High Risk (61-80)**: Significant violations
- **Critical Risk (81-100)**: Severe violations requiring immediate action

#### Automatic Actions

- **Warnings**: Display alerts for medium-risk behaviors
- **Session Termination**: Auto-end sessions above risk threshold
- **Instructor Alerts**: Email notifications for high-risk sessions

## Event Types & Severities

### Event Categories

#### Session Events

- `session_start`: Session initialization
- `session_end`: Session completion
- `identity_verification`: ID verification process
- `environment_scan`: Room scanning

#### Behavioral Events

- `face_not_visible`: Student looks away from camera
- `multiple_faces`: Multiple people detected
- `looking_away`: Extended gaze deviation
- `tab_switch`: Browser tab change
- `window_minimized`: Window minimization
- `browser_leave`: Browser focus loss

#### Technical Events

- `suspicious_audio`: Unusual background noise
- `device_disconnected`: Camera/microphone disconnection
- `network_issue`: Connectivity problems

#### Administrative Events

- `manual_flag`: Instructor manual flag
- `auto_flag`: System automatic flag
- `proctor_message`: Proctor communication

### Severity Levels

#### Low Severity

- Minor behavioral observations
- Technical glitches
- Brief attention lapses

#### Medium Severity

- Moderate behavioral violations
- Multiple minor infractions
- Technical issues affecting monitoring

#### High Severity

- Significant behavioral violations
- Attempted circumvention of security
- Extended unauthorized activities

#### Critical Severity

- Severe violations requiring immediate action
- Multiple high-severity events
- Clear intent to cheat

## Compliance & Standards

### International Standards Compliance

#### GDPR Compliance

- **Data Minimization**: Only collect necessary monitoring data
- **Purpose Limitation**: Data used solely for academic integrity
- **Storage Limitation**: Automatic data deletion after retention period
- **Security Measures**: Encrypted data storage and transmission
- **User Rights**: Student access to their monitoring data

#### Accessibility Standards

- **WCAG 2.1 Compliance**: Accessible interface design
- **Alternative Monitoring**: Options for students with disabilities
- **Clear Communication**: Transparent proctoring policies
- **Technical Accommodations**: Support for assistive technologies

#### Academic Integrity Standards

- **Fair Assessment**: Consistent monitoring across all students
- **Evidence-Based**: All flags supported by recorded evidence
- **Due Process**: Clear procedures for addressing violations
- **Educational Focus**: Emphasis on learning rather than punishment

### Privacy Considerations

#### Data Collection

- **Minimal Data**: Only collect data necessary for proctoring
- **Purpose Specification**: Clear communication of data usage
- **Consent Requirements**: Student acknowledgment before monitoring
- **Data Retention**: Configurable retention periods

#### Data Security

- **Encryption**: All data encrypted in transit and at rest
- **Access Controls**: Role-based access to monitoring data
- **Audit Trails**: Complete logging of data access
- **Secure Deletion**: Permanent data removal after retention

## Troubleshooting

### Common Issues

#### Session Won't Start

- Check camera/microphone permissions
- Verify internet connection
- Ensure browser compatibility
- Check proctoring settings configuration

#### Poor Video Quality

- Check camera settings and permissions
- Ensure adequate lighting
- Verify network bandwidth
- Update browser and drivers

#### False Positives

- Adjust sensitivity settings
- Review environmental factors
- Calibrate face detection
- Update monitoring rules

#### Technical Glitches

- Clear browser cache and cookies
- Disable browser extensions
- Check system requirements
- Contact technical support

### Support Resources

#### Documentation

- Complete API documentation
- Configuration guides
- Troubleshooting manuals
- Best practices guides

#### Technical Support

- Email: support@spwms.edu
- Phone: +1-800-PROCTOR
- Live chat: Available during business hours
- Community forums: User discussion boards

## Future Enhancements

### Planned Features

- **AI-Powered Analysis**: Advanced behavioral pattern recognition
- **Mobile Support**: Proctoring for mobile devices
- **Integration APIs**: Third-party LMS integration
- **Advanced Analytics**: Predictive risk modeling
- **Multi-Language Support**: Internationalization features

### Research & Development

- **Machine Learning**: Improved violation detection algorithms
- **Biometric Analysis**: Advanced identity verification methods
- **Behavioral Analytics**: Long-term pattern analysis
- **Accessibility Improvements**: Enhanced support for diverse needs

---

## Contact Information

For technical support or questions about the proctoring system:

- **Technical Support**: support@spwms.edu
- **Documentation**: docs.spwms.edu/proctoring
- **Community Forums**: community.spwms.edu
- **GitHub Repository**: github.com/spwms/proctoring

---

_This documentation is maintained by the SPWMS development team. Last updated: November 2025_

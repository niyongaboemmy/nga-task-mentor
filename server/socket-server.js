// Store active streams in memory
const activeStreams = new Map();

const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/html",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Socket.IO Server Status</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f0f0; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #28a745; }
            .status { color: #007bff; font-size: 18px; }
            .info { color: #6c757d; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>✅ Socket.IO Server Status</h1>
            <p class="status">The socket server is running successfully on port 5002</p>
            <p class="info">This server handles real-time WebSocket connections for proctoring functionality.</p>
            <p class="info">Dashboard can connect to: <code>http://localhost:5002</code></p>
        </div>
    </body>
    </html>
  `);
});
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST"],
  },
  allowEIO3: true,
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-proctoring-session", (data) => {
    const { sessionToken, role = "student" } = data;
    socket.join("proctoring-" + sessionToken);
    console.log(
      "Client " +
        socket.id +
        " joined proctoring session: " +
        sessionToken +
        " as " +
        role
    );

    // If this is a dashboard joining, notify the student to reset their connection
    if (role === "dashboard") {
      console.log(
        "Dashboard joined session " +
          sessionToken +
          ", notifying student to reset connection"
      );
      socket.to("proctoring-" + sessionToken).emit("dashboard-reconnected", {
        sessionToken,
        message:
          "Dashboard has reconnected, please reset your WebRTC connection",
      });
    }
  });

  socket.on("leave-proctoring-session", (sessionToken) => {
    socket.leave("proctoring-" + sessionToken);
    console.log(
      "Client " + socket.id + " left proctoring session: " + sessionToken
    );
  });

  socket.on("student-stream-started", (data) => {
    console.log("Student stream started:", data);
    const { sessionToken, studentInfo, quizInfo } = data;

    // Check if this is a reconnection (stream already exists)
    const existingStream = activeStreams.get(sessionToken);
    const isReconnection = !!existingStream;

    // Store stream info
    activeStreams.set(sessionToken, {
      sessionToken,
      student: studentInfo,
      quiz: quizInfo,
      startTime: new Date(),
      socketId: socket.id,
      isLive: true,
      lastReconnection: isReconnection ? new Date() : null,
    });

    // Database updates are handled by the main Express server via API calls
    // This socket server focuses on real-time WebRTC communication only

    // Notify all dashboard clients about the new stream or reconnection
    io.emit("stream-started", {
      sessionToken,
      student: studentInfo,
      quiz: quizInfo,
      startTime: new Date(),
      isLive: true,
      isReconnection,
    });

    console.log("Active streams count:", activeStreams.size);
    if (isReconnection) {
      console.log("Student reconnected to stream:", sessionToken);
    }
  });

  socket.on("student-stream-ended", (sessionToken) => {
    console.log("Student stream ended:", sessionToken);

    if (activeStreams.has(sessionToken)) {
      activeStreams.delete(sessionToken);

      // Database updates are handled by the main Express server via API calls
      // This socket server focuses on real-time WebRTC communication only

      // Notify all dashboard clients about the ended stream
      io.emit("stream-ended", { sessionToken });

      console.log("Active streams count:", activeStreams.size);
    }
  });

  // Handle explicit stream resumption (when student comes back)
  socket.on("resume-stream", (sessionToken) => {
    console.log("Student attempting to resume stream:", sessionToken);

    const existingStream = activeStreams.get(sessionToken);
    if (existingStream && !existingStream.socketId) {
      // Update the stream with new socket ID and mark as live again
      activeStreams.set(sessionToken, {
        ...existingStream,
        socketId: socket.id,
        isLive: true,
        lastReconnection: new Date(),
        disconnectedAt: null,
      });

      // Notify dashboard that stream has resumed
      io.emit("stream-resumed", {
        sessionToken,
        resumedAt: new Date(),
        wasDisconnected: true,
      });

      console.log("Stream resumed successfully:", sessionToken);
    } else if (!existingStream) {
      // If no existing stream, this might be a new connection
      socket.emit("stream-not-found", { sessionToken });
    }
  });

  socket.on("get-active-streams", async () => {
    try {
      // Send only the streams that are currently active in our socket server memory
      // This ensures we only show streams that are actually connected to the socket server
      const streams = Array.from(activeStreams.values());
      socket.emit("active-streams", streams);
    } catch (error) {
      console.error("Error getting active streams:", error);
      socket.emit("active-streams", []);
    }
  });

  socket.on("student-webrtc-ready", (data) => {
    console.log("Student signaled WebRTC readiness:", data);
    // Forward readiness signal to dashboard clients in the room
    socket.to("proctoring-" + data.sessionToken).emit("student-webrtc-ready", {
      sessionToken: data.sessionToken,
      message: data.message,
      from: socket.id,
    });
    console.log(
      "Forwarded student WebRTC ready signal to room:",
      "proctoring-" + data.sessionToken
    );
  });

  socket.on("webrtc-offer", (data) => {
    console.log("Received WebRTC offer:", data);
    // Send offer to all clients in the room except the sender
    socket.to("proctoring-" + data.sessionToken).emit("webrtc-offer", {
      offer: data.offer,
      from: socket.id,
      sessionToken: data.sessionToken,
    });
    console.log(
      "Forwarded WebRTC offer to room:",
      "proctoring-" + data.sessionToken
    );
  });

  socket.on("webrtc-answer", (data) => {
    console.log("Received WebRTC answer:", data);
    // Send answer to all clients in the room except the sender
    socket.to("proctoring-" + data.sessionToken).emit("webrtc-answer", {
      answer: data.answer,
      from: socket.id,
      sessionToken: data.sessionToken,
    });
    console.log(
      "Forwarded WebRTC answer to room:",
      "proctoring-" + data.sessionToken
    );
  });

  socket.on("webrtc-ice-candidate", (data) => {
    console.log("Received WebRTC ICE candidate:", data);
    // Send ICE candidate to all clients in the room except the sender
    socket.to("proctoring-" + data.sessionToken).emit("webrtc-ice-candidate", {
      candidate: data.candidate,
      from: socket.id,
      sessionToken: data.sessionToken,
    });
    console.log(
      "Forwarded WebRTC ICE candidate to room:",
      "proctoring-" + data.sessionToken
    );
  });

  socket.on("request-student-audio-confirmation", (data) => {
    console.log("Received request for student audio confirmation:", data);
    // Send confirmation request to all clients in the room (should reach the student)
    socket
      .to("proctoring-" + data.sessionToken)
      .emit("request-student-audio-confirmation", {
        sessionToken: data.sessionToken,
        volume: data.volume || 0.5,
        micGain: data.micGain || 0.6,
        requestId: data.requestId,
      });
    console.log(
      "Forwarded audio confirmation request to room:",
      "proctoring-" + data.sessionToken
    );
  });

  socket.on("student-audio-confirmation", (data) => {
    console.log("Received student audio confirmation:", data);
    // Send confirmation response to all clients in the room (should reach the dashboard)
    socket
      .to("proctoring-" + data.sessionToken)
      .emit("student-audio-confirmation", {
        sessionToken: data.sessionToken,
        confirmed: data.confirmed,
        requestId: data.requestId,
      });
    console.log(
      "Forwarded student audio confirmation to room:",
      "proctoring-" + data.sessionToken
    );
  });

  socket.on("force-student-audio", (data) => {
    console.log("Received force student audio command:", data);
    // Send command to all clients in the room (should reach the student)
    socket.to("proctoring-" + data.sessionToken).emit("force-student-audio", {
      sessionToken: data.sessionToken,
      volume: data.volume || 0.5,
      micGain: data.micGain || 0.6,
    });
    console.log(
      "Forwarded force audio command to room:",
      "proctoring-" + data.sessionToken
    );
  });

  socket.on("proctoring-violation", (data) => {
    console.log("Received proctoring violation:", data);
    const { sessionToken, quizId, violation } = data;

    // Forward violation to all dashboard clients (instructors monitoring this session)
    socket.to("proctoring-" + sessionToken).emit("proctoring-violation", {
      sessionToken,
      quizId,
      violation,
      timestamp: new Date(),
    });

    // Also emit globally for any dashboard clients that might be listening
    io.emit("global-proctoring-violation", {
      sessionToken,
      quizId,
      violation,
      timestamp: new Date(),
    });

    console.log(
      "Forwarded proctoring violation to room:",
      "proctoring-" + sessionToken
    );
  });

  socket.on("end-student-quiz", (data) => {
    console.log("Received end student quiz command:", data);
    const { sessionToken, reason } = data;

    // Forward termination command to student
    socket.to("proctoring-" + sessionToken).emit("quiz-terminated", {
      sessionToken,
      reason,
      terminatedAt: new Date(),
    });

    console.log(
      "Forwarded quiz termination to room:",
      "proctoring-" + sessionToken
    );
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // Don't immediately clean up streams - implement Google Meet style reconnection
    // Mark streams as temporarily disconnected instead of deleting them
    for (const [sessionToken, streamData] of activeStreams.entries()) {
      if (streamData.socketId === socket.id) {
        // Mark as temporarily disconnected, but keep the stream data
        activeStreams.set(sessionToken, {
          ...streamData,
          socketId: null, // Clear socket ID but keep stream data
          isLive: false, // Mark as not live
          disconnectedAt: new Date(),
        });

        // Notify dashboard that stream is temporarily offline
        io.emit("stream-paused", {
          sessionToken,
          reason: "student_disconnected",
          disconnectedAt: new Date(),
        });

        console.log("Marked stream as temporarily disconnected:", sessionToken);
      }
    }
  });
});

server.listen(5002, () => {
  console.log("Socket.IO server running on port 5002");
  console.log("CORS enabled for http://localhost:5175");
});

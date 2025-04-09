devhub-lan/
├── frontend/              # UI files (HTML, JS, CSS)
│   ├── index.html
│   ├── renderer.js        # Frontend JS (handles UI, sockets, etc.)
│   ├── styles.css
│   └── assets/            # Icons, images, etc.
│
├── server/                # Backend (Node.js + Socket.io)
│   ├── index.js           # Main backend server
│   ├── routes/            # Optional (for file sharing routes, etc.)
│   └── utils/             # Optional (helper functions)
│
├── main.js                # Electron entry point (launches frontend + backend)
├── preload.js             # (Optional) Secure bridge between Electron & frontend
├── package.json           # Project metadata and scripts
├── .env                   # Config (port, env variables)
└── README.md              # Project overview

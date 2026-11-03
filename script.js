/* =========================================================================
       PHẦN 2: QUẢN LÝ TRẠNG THÁI & ÂM THANH (WEB AUDIO + MP3)
       ========================================================================= */
    let currentPhotoIndex = 0;
    let autoPlayInterval = null;
    let particleInterval = null;
    let isAutoPlaying = false;
    let isMusicPlaying = false;

    // Trạng thái lưu trữ đoạn chat cố định (Không bị reset khi thoát ra)
    const CHAT_STORAGE_KEY = "locket_birthday_chat_history_v1";
    let chatHistory = [];
    let introSequenceCompleted = false;
    let introSequenceRunning = false;
    let chatTypingTimeouts = [];

    // Web Audio Synth fallback nếu người dùng chưa gắn file MP3
    let audioCtx = null;
    let synthInterval = null;
    const bgMusicAudio = document.getElementById("bgMusicAudio");

    function startRomanticMusic() {
      if (isMusicPlaying) return;
      isMusicPlaying = true;
      updateMusicIcon();

      if (CONFIG.musicUrl && CONFIG.musicUrl.trim() !== "") {
        bgMusicAudio.src = CONFIG.musicUrl;
        bgMusicAudio.volume = 0.65;
        bgMusicAudio.play().catch(() => {});
        return;
      }

      // Phát giai điệu Music Box ngọt ngào tự động bằng Web Audio API
      try {
        if (!audioCtx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === "suspended") {
          audioCtx.resume();
        }

        const melodyNotes = [
          523.25, 659.25, 783.99, 1046.5, 880.0, 1046.5, 783.99, 659.25,
          698.46, 880.0, 1046.5, 880.0, 783.99, 659.25, 587.33, 783.99
        ];
        let step = 0;

        const playNote = (freq) => {
          if (!isMusicPlaying || !audioCtx) return;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

          gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.1);

          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 1.15);
        };

        playNote(melodyNotes[0]);
        synthInterval = setInterval(() => {
          if (!isMusicPlaying) return;
          step = (step + 1) % melodyNotes.length;
          playNote(melodyNotes[step]);
        }, 460);
      } catch (e) {
        // Bỏ qua nếu trình duyệt chặn âm thanh
      }
    }

    function toggleMusic() {
      if (isMusicPlaying) {
        isMusicPlaying = false;
        bgMusicAudio.pause();
        if (synthInterval) clearInterval(synthInterval);
      } else {
        startRomanticMusic();
      }
      updateMusicIcon();
    }

    function updateMusicIcon() {
      const icon = document.getElementById("musicIcon");
      if (isMusicPlaying) {
        icon.className = "fa-solid fa-bullhorn text-sm -rotate-12 text-yellow-400";
      } else {
        icon.className = "fa-solid fa-volume-xmark text-sm text-zinc-500";
      }
    }

    /* =========================================================================
       PHẦN 3: ĐIỀU HƯỚNG MÀN HÌNH & KHỞI TẠO LƯỚI ẢNH LOCKET
       ========================================================================= */
    const screens = [
      "screenIntro",
      "screenMainGrid",
      "screenPhotoViewer",
      "screenRollcall",
      "screenCalendar",
      "screenChatList",
      "screenChatRoom",
      "screenCake3D",
      "modalCustomPhotos"
    ];

    let isStackedGridMode = Boolean(CONFIG.defaultStackedGrid);

    function showScreen(targetId, keepMainGridBehind = false) {
      screens.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === targetId) {
          el.classList.remove("screen-hidden");
          el.classList.add("screen-active");
        } else if (keepMainGridBehind && id === "screenMainGrid") {
          el.classList.remove("screen-hidden");
          el.classList.add("screen-active");
        } else {
          el.classList.remove("screen-active");
          el.classList.add("screen-hidden");
        }
      });

      if (targetId !== "screenPhotoViewer") {
        stopAutoPlaySlideshow();
      }
      if (targetId === "screenCake3D") {
        startCake3DAnimation();
      } else {
        stopCake3DAnimation();
      }
    }

    function closeModal(modalId) {
      const el = document.getElementById(modalId);
      if (el) {
        el.classList.remove("screen-active");
        el.classList.add("screen-hidden");
      }
      if (modalId === "screenPhotoViewer") {
        stopAutoPlaySlideshow();
      }
      if (modalId === "screenCake3D") {
        stopCake3DAnimation();
      }
    }

    // Cập nhật toàn bộ ảnh đại diện & lưới ảnh
    function initAppUI() {
      const avatarPhoto = CONFIG.photos[11]?.url || CONFIG.photos[0].url;
      const topPhoto = CONFIG.photos[0].url;

      document.getElementById("headerAvatarImg").src = topPhoto;
      document.getElementById("chatTopAvatar").src = topPhoto;
      document.getElementById("chatListSenderAvatar").src = avatarPhoto;
      document.getElementById("chatRoomAvatar").src = avatarPhoto;
      document.getElementById("viewerAuthorAvatar").src = topPhoto;

      document.getElementById("chatSenderNameList").textContent = CONFIG.senderName;
      document.getElementById("chatSenderNameRoom").textContent = CONFIG.senderName;
      document.getElementById("chatPreviewText").textContent = CONFIG.chatPreview;
      document.getElementById("cakeWishFooter").textContent = CONFIG.cakeFooterText;
      document.getElementById("viewerAuthorName").textContent = CONFIG.photoFeedAuthorName || "sáng nắng";

      loadSavedChatHistory();
      renderPhotoGrid();
      renderRollcallFeed();
      renderExtraFriendChats();
      renderCalendar();
      build3DBirthdayCake();
    }

    // Render 15+ bức ảnh lên lưới 3 cột (Hỗ trợ cả Lưới chuẩn & Lưới xếp chồng thẻ)
    function renderPhotoGrid() {
      const grid = document.getElementById("photoGridContainer");
      grid.innerHTML = "";
      if (isStackedGridMode) {
        grid.classList.add("grid-stacked-mode");
      } else {
        grid.classList.remove("grid-stacked-mode");
      }

      CONFIG.photos.forEach((item, index) => {
        const cell = document.createElement("div");
        cell.className =
          "aspect-square rounded-[22px] overflow-hidden bg-zinc-900 cursor-pointer relative group active:scale-95 transition-transform duration-200";
        cell.innerHTML = `
          <img
            src="${item.url}"
            alt="Photo ${index + 1}"
            loading="lazy"
            onerror="this.src='https://placehold.co/400x400/27272a/eab308?text=Anh+${index + 1}'"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        `;
        cell.addEventListener("click", () => {
          openPhotoViewer(index);
        });
        grid.appendChild(cell);
      });
    }

    // Render màn hình Rollcall giống ảnh 4
    function renderRollcallFeed() {
      const container = document.getElementById("rollcallFeedContainer");
      if (!container) return;
      container.innerHTML = "";

      const cornerThumb = document.getElementById("rollcallCornerThumb");
      const cornerAvatar = document.getElementById("rollcallCornerAvatar");
      if (cornerThumb) cornerThumb.src = CONFIG.photos[0].url;
      if (cornerAvatar) cornerAvatar.src = CONFIG.photos[1 % CONFIG.photos.length].url;

      const rollcallAuthors = [
        { name: "Emmm", day: "Thứ Hai" },
        { name: "Yến Nhi", day: "Thứ Ba" },
        { name: "Người luôn yêu em", day: "Chủ Nhật" },
        { name: "Thảo đêyy 🎀", day: "Thứ Bảy" },
        { name: "Bunnie 🐰", day: "Thứ Sáu" }
      ];

      const totalPosts = Math.min(5, CONFIG.photos.length);
      for (let i = 0; i < totalPosts; i++) {
        const item = CONFIG.photos[i];
        const author = rollcallAuthors[i % rollcallAuthors.length];
        const post = document.createElement("div");
        post.className = "flex flex-col";
        post.innerHTML = `
          <div class="relative w-full aspect-[3/4] bg-zinc-900 overflow-hidden">
            <img src="${item.url}" alt="Rollcall ${i + 1}" class="w-full h-full object-cover" />
            <div class="absolute top-3.5 right-3.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-bold">
              ${i + 1} / ${totalPosts}
            </div>
            <button
              type="button"
              class="rollcall-react-btn absolute bottom-3.5 right-3.5 w-11 h-11 rounded-full bg-black/55 backdrop-blur-md flex items-center justify-center text-white text-lg hover:scale-110 active:scale-90 transition"
            >
              <i class="fa-regular fa-face-smile-plus"></i>
            </button>
          </div>
          <div class="flex items-center justify-between px-4 pt-3">
            <div class="flex items-center gap-3">
              <img src="${item.url}" alt="${author.name}" class="w-11 h-11 rounded-full object-cover border border-white/15" />
              <div>
                <p class="text-white font-bold text-[15px] leading-tight">${author.name}</p>
                <p class="text-zinc-400 text-xs mt-0.5">${author.day}</p>
              </div>
            </div>
            <div class="flex items-center gap-4 text-zinc-400 text-lg">
              <button type="button" class="hover:text-white"><i class="fa-solid fa-ellipsis"></i></button>
              <button type="button" class="rollcall-comment-btn hover:text-white"><i class="fa-regular fa-comment-dots"></i></button>
            </div>
          </div>
        `;
        post.querySelector(".rollcall-react-btn").addEventListener("click", () => {
          showScreen("screenCake3D", true);
        });
        post.querySelector(".rollcall-comment-btn").addEventListener("click", () => {
          showScreen("screenChatRoom");
          openChatRoomAndEnsureState();
        });
        container.appendChild(post);
      }
    }

    // Render danh sách bạn bè trong mục Trò chuyện giống hệt ảnh 2
    function renderExtraFriendChats() {
      const listEl = document.getElementById("extraFriendsChatList");
      if (!listEl || !Array.isArray(CONFIG.friendChats)) return;
      listEl.innerHTML = "";

      CONFIG.friendChats.forEach((friend) => {
        const avatarUrl = CONFIG.photos[friend.photoIdx % CONFIG.photos.length].url;
        const row = document.createElement("button");
        row.type = "button";
        row.className =
          "w-full p-2.5 rounded-2xl hover:bg-zinc-900 active:bg-zinc-800 transition flex items-center justify-between text-left";
        row.innerHTML = `
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-[54px] h-[54px] rounded-full p-[2px] border border-zinc-700 flex-shrink-0 overflow-hidden">
              <img src="${avatarUrl}" alt="${friend.name}" class="w-full h-full rounded-full object-cover" />
            </div>
            <div class="min-w-0">
              <p class="font-bold text-white text-[16px] truncate">${friend.name}</p>
              <p class="text-zinc-400 text-sm truncate mt-0.5">${friend.preview}</p>
            </div>
          </div>
          <span class="text-zinc-500 text-xs font-medium flex-shrink-0 ml-2">${friend.time}</span>
        `;
        row.addEventListener("click", () => {
          showScreen("screenChatRoom");
          openChatRoomAndEnsureState();
        });
        listEl.appendChild(row);
      });
    }

    /* =========================================================================
       PHẦN 4: TRÌNH XEM ẢNH CHI TIẾT (SLIDESHOW) & HIỆU ỨNG MƯA TIM / HỘP QUÀ
       ========================================================================= */
    function openPhotoViewer(index) {
      currentPhotoIndex = (index + CONFIG.photos.length) % CONFIG.photos.length;
      updatePhotoViewerContent();
      showScreen("screenPhotoViewer", true);
    }

    function updatePhotoViewerContent() {
      const currentItem = CONFIG.photos[currentPhotoIndex];
      const nextIndex = (currentPhotoIndex + 1) % CONFIG.photos.length;
      const nextItem = CONFIG.photos[nextIndex];

      const mainImg = document.getElementById("viewerMainImage");
      const captionEl = document.getElementById("viewerCaptionPill");
      const nextThumb = document.getElementById("viewerNextThumbImg");

      mainImg.style.opacity = "0.35";
      mainImg.style.transform = "scale(0.97)";

      setTimeout(() => {
        mainImg.src = currentItem.url;
        captionEl.textContent = currentItem.caption || "Love you! 💕";
        nextThumb.src = nextItem.url;
        mainImg.style.opacity = "1";
        mainImg.style.transform = "scale(1)";
      }, 90);

      // Render chấm phân trang
      const dotsContainer = document.getElementById("viewerDotsContainer");
      dotsContainer.innerHTML = "";
      CONFIG.photos.forEach((_, idx) => {
        const dot = document.createElement("button");
        const isActive = idx === currentPhotoIndex;
        dot.className = isActive
          ? "w-2 h-2 rounded-full bg-white scale-110 transition-all"
          : "w-1.5 h-1.5 rounded-full bg-zinc-600 hover:bg-zinc-400 transition-all";
        dot.addEventListener("click", () => {
          currentPhotoIndex = idx;
          updatePhotoViewerContent();
        });
        dotsContainer.appendChild(dot);
      });
    }

    function nextPhotoSlide() {
      currentPhotoIndex = (currentPhotoIndex + 1) % CONFIG.photos.length;
      updatePhotoViewerContent();
    }

    function prevPhotoSlide() {
      currentPhotoIndex = (currentPhotoIndex - 1 + CONFIG.photos.length) % CONFIG.photos.length;
      updatePhotoViewerContent();
    }

    // Hiệu ứng tạo mưa trái tim hồng & hộp quà sinh nhật như trong video (0:29 - 0:32)
    function spawnFloatingGiftsAndHearts(count = 7) {
      const layer = document.getElementById("floatingParticlesLayer");
      const icons = ["🎁", "💝", "💖", "💗", "💓", "💞", "🌸"];

      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const el = document.createElement("div");
          el.className = "floating-particle select-none drop-shadow-md";
          el.textContent = icons[Math.floor(Math.random() * icons.length)];
          el.style.left = `${10 + Math.random() * 80}%`;
          el.style.fontSize = `${24 + Math.random() * 18}px`;
          layer.appendChild(el);

          setTimeout(() => {
            el.remove();
          }, 3600);
        }, i * 130);
      }
    }

    function toggleAutoPlaySlideshow() {
      if (isAutoPlaying) {
        stopAutoPlaySlideshow();
      } else {
        startAutoPlaySlideshow();
      }
    }

    function startAutoPlaySlideshow() {
      isAutoPlaying = true;
      const btn = document.getElementById("btnAutoPlayToggle");
      const knob = document.getElementById("autoPlayKnob");
      btn.classList.remove("bg-zinc-700");
      btn.classList.add("bg-yellow-400");
      knob.classList.remove("bg-zinc-300");
      knob.classList.add("bg-white", "translate-x-5");

      spawnFloatingGiftsAndHearts(10);

      if (autoPlayInterval) clearInterval(autoPlayInterval);
      if (particleInterval) clearInterval(particleInterval);

      autoPlayInterval = setInterval(() => {
        nextPhotoSlide();
      }, 1700);

      particleInterval = setInterval(() => {
        spawnFloatingGiftsAndHearts(6);
      }, 1200);
    }

    function stopAutoPlaySlideshow() {
      isAutoPlaying = false;
      const btn = document.getElementById("btnAutoPlayToggle");
      const knob = document.getElementById("autoPlayKnob");
      if (btn && knob) {
        btn.classList.add("bg-zinc-700");
        btn.classList.remove("bg-yellow-400");
        knob.classList.add("bg-zinc-300");
        knob.classList.remove("bg-white", "translate-x-5");
      }
      if (autoPlayInterval) clearInterval(autoPlayInterval);
      if (particleInterval) clearInterval(particleInterval);
    }

    /* =========================================================================
       PHẦN 5: LỊCH KỶ NIỆM THÁNG 5 & THÁNG 6 2026 (NGÀY 08/06 VIỀN VÀNG)
       ========================================================================= */
    function renderCalendar() {
      const mayGrid = document.getElementById("calendarMayGrid");
      const juneGrid = document.getElementById("calendarJuneGrid");
      mayGrid.innerHTML = "";
      juneGrid.innerHTML = "";

      // --- THÁNG 5 2026 (4 ô chấm trống đầu tháng + 31 ngày) ---
      for (let e = 0; e < 4; e++) {
        const dotCell = document.createElement("div");
        dotCell.className = "aspect-[4/5] rounded-lg bg-[#27272a]/50 flex items-center justify-center text-zinc-600 text-xs";
        dotCell.textContent = "•";
        mayGrid.appendChild(dotCell);
      }

      // Các ngày trong tháng 5 có gắn ảnh kỷ niệm & emoji giống hệt video
      const mayPhotoDays = {
        1: { photoIdx: 0, badge: "" },
        5: { photoIdx: 1, badge: "💛" },
        6: { photoIdx: 2, badge: "" },
        12: { photoIdx: 3, badge: "" },
        13: { photoIdx: 4, badge: "" },
        15: { photoIdx: 5, badge: "✨" },
        16: { photoIdx: 6, badge: "" },
        17: { photoIdx: 7, badge: "😍" },
        19: { photoIdx: 8, badge: "" },
        20: { photoIdx: 9, badge: "" },
        22: { photoIdx: 10, badge: "" },
        23: { photoIdx: 11, badge: "" },
        24: { photoIdx: 12, badge: "💞" },
        25: { photoIdx: 13, badge: "🌸" },
        26: { photoIdx: 14, badge: "" },
        27: { photoIdx: 0, badge: "" },
        29: { photoIdx: 2, badge: "" }
      };

      for (let d = 1; d <= 31; d++) {
        const cell = document.createElement("div");
        const memory = mayPhotoDays[d];

        if (memory) {
          const imgUrl = CONFIG.photos[memory.photoIdx % CONFIG.photos.length].url;
          cell.className =
            "relative aspect-[4/5] rounded-lg overflow-hidden cursor-pointer group active:scale-95 transition";
          cell.innerHTML = `
            <img src="${imgUrl}" class="w-full h-full object-cover" />
            ${
              memory.badge
                ? `<span class="absolute -top-0.5 -right-0.5 text-[10px] drop-shadow">${memory.badge}</span>`
                : ""
            }
          `;
          cell.addEventListener("click", () => {
            closeModal("screenCalendar");
            openPhotoViewer(memory.photoIdx % CONFIG.photos.length);
          });
        } else {
          cell.className =
            "aspect-[4/5] rounded-lg bg-[#27272a] flex items-center justify-center text-xs font-semibold text-zinc-300";
          cell.textContent = d;
        }
        mayGrid.appendChild(cell);
      }

      // --- THÁNG 6 2026 (Ngày 1,2,4,5,7 có ảnh; Ngày 8 khung viền Vàng + 🎂) ---
      const junePhotoDays = {
        1: { photoIdx: 4, badge: "" },
        2: { photoIdx: 5, badge: "" },
        4: { photoIdx: 8, badge: "" },
        5: { photoIdx: 1, badge: "💛" },
        7: { photoIdx: 11, badge: "" }
      };

      for (let d = 1; d <= 30; d++) {
        const cell = document.createElement("div");

        if (d === 8) {
          // NGÀY SINH NHẬT 08/06 ĐẶC BIỆT (Viền vàng rực + Bánh sinh nhật)
          cell.className =
            "relative aspect-[4/5] rounded-lg bg-[#27272a] border-2 border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.75)] flex items-center justify-center text-xs font-extrabold text-white cursor-pointer active:scale-90 transition animate-pulse";
          cell.innerHTML = `
            <span>8</span>
            <span class="absolute -top-2 -left-1.5 text-xs">🎂</span>
          `;
          cell.addEventListener("click", () => {
            showScreen("screenCake3D", true);
          });
        } else if (junePhotoDays[d]) {
          const mem = junePhotoDays[d];
          const imgUrl = CONFIG.photos[mem.photoIdx % CONFIG.photos.length].url;
          cell.className =
            "relative aspect-[4/5] rounded-lg overflow-hidden cursor-pointer active:scale-95 transition";
          cell.innerHTML = `
            <img src="${imgUrl}" class="w-full h-full object-cover" />
            ${
              mem.badge
                ? `<span class="absolute -top-0.5 -right-0.5 text-[10px] drop-shadow">${mem.badge}</span>`
                : ""
            }
          `;
          cell.addEventListener("click", () => {
            closeModal("screenCalendar");
            openPhotoViewer(mem.photoIdx % CONFIG.photos.length);
          });
        } else {
          cell.className =
            "aspect-[4/5] rounded-lg bg-[#27272a] flex items-center justify-center text-xs font-semibold text-zinc-300";
          cell.textContent = d;
        }

        juneGrid.appendChild(cell);
      }
    }

    /* =========================================================================
       PHẦN 6: PHÒNG TRÒ CHUYỆN TỰ ĐỘNG GÕ & AI TRẢ LỜI (GIỮ NGUYÊN LỊCH SỬ)
       ========================================================================= */
    function getAvatarUrl() {
      return CONFIG.photos[11]?.url || CONFIG.photos[0].url;
    }

    // Tải lịch sử chat đã lưu (nếu có) để không bị mất khi thoát ra
    function loadSavedChatHistory() {
      try {
        const raw = localStorage.getItem(CHAT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            chatHistory = parsed.messages;
            introSequenceCompleted = Boolean(parsed.introSequenceCompleted);
            renderAllChatMessagesFromState();
            updateInboxPreviewText();
          }
        }
      } catch (e) {
        // Bỏ qua nếu trình duyệt chặn localStorage
      }
    }

    // Lưu lịch sử chat hiện tại vào bộ nhớ
    function saveChatHistory() {
      updateInboxPreviewText();
      try {
        localStorage.setItem(
          CHAT_STORAGE_KEY,
          JSON.stringify({
            messages: chatHistory,
            introSequenceCompleted: introSequenceCompleted
          })
        );
      } catch (e) {
        // Bỏ qua nếu bộ nhớ đầy
      }
    }

    // Cập nhật dòng xem trước ở màn hình danh sách "Trò chuyện"
    function updateInboxPreviewText() {
      const previewEl = document.getElementById("chatPreviewText");
      if (!previewEl) return;
      if (chatHistory.length > 0) {
        const lastMsg = chatHistory[chatHistory.length - 1];
        const prefix = lastMsg.role === "user" ? "Bạn: " : "";
        previewEl.textContent = prefix + lastMsg.text;
      } else {
        previewEl.textContent = CONFIG.chatPreview;
      }
    }

    // Tạo phần tử DOM bong bóng đang gõ 3 chấm (...)
    function createTypingBubbleDOM(id = "partnerTypingRow") {
      const avatarUrl = getAvatarUrl();
      const row = document.createElement("div");
      row.id = id;
      row.className = "flex items-end gap-2.5 chat-bubble-enter";
      row.innerHTML = `
        <img src="${avatarUrl}" class="w-7 h-7 rounded-full object-cover mb-0.5 flex-shrink-0" />
        <div class="bg-[#262626] px-4 py-3 rounded-2xl rounded-bl-sm flex items-center">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      `;
      return row;
    }

    // Tạo phần tử DOM cho 1 tin nhắn (của người gửi hoặc của bạn)
    function createMessageBubbleDOM(msg, animate = true) {
      const avatarUrl = getAvatarUrl();
      const row = document.createElement("div");

      if (msg.role === "partner") {
        row.className = `flex items-end gap-2.5 ${animate ? "chat-bubble-enter" : ""}`;
        row.innerHTML = `
          <img src="${avatarUrl}" class="w-7 h-7 rounded-full object-cover mb-0.5 flex-shrink-0" />
          <div class="bg-[#262626] text-white text-sm px-4 py-2.5 rounded-2xl rounded-bl-sm max-w-[78%] leading-snug shadow"></div>
        `;
        row.querySelector("div").textContent = msg.text;
      } else {
        row.className = `flex justify-end ${animate ? "chat-bubble-enter" : ""}`;
        row.innerHTML = `
          <div class="bg-[#facc15] text-black font-medium text-sm px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[78%] leading-snug shadow"></div>
        `;
        row.querySelector("div").textContent = msg.text;
      }
      return row;
    }

    function scrollChatToBottom() {
      const container = document.getElementById("chatMessagesContainer");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }

    // Vẽ lại toàn bộ tin nhắn đã có trong lịch sử (không chạy lại hiệu ứng từ đầu)
    function renderAllChatMessagesFromState() {
      const container = document.getElementById("chatMessagesContainer");
      if (!container) return;
      container.innerHTML = "";
      chatHistory.forEach((msg) => {
        container.appendChild(createMessageBubbleDOM(msg, false));
      });
      scrollChatToBottom();
    }

    // Mở phòng chat: Chỉ chạy chuỗi 4 tin nhắn mở đầu ở LẦN ĐẦU TIÊN.
    // Các lần mở sau giữ nguyên toàn bộ tin nhắn cũ và mới!
    function openChatRoomAndEnsureState() {
      const container = document.getElementById("chatMessagesContainer");

      // Nếu chuỗi mở đầu đã chạy xong hoặc đã có lịch sử chat -> giữ nguyên, chỉ cuộn xuống cuối
      if (introSequenceCompleted || introSequenceRunning) {
        if (container.children.length === 0 && chatHistory.length > 0) {
          renderAllChatMessagesFromState();
        }
        scrollChatToBottom();
        return;
      }

      // Lần đầu tiên mở phòng chat: Chạy hiệu ứng gõ 4 tin nhắn mở đầu
      introSequenceRunning = true;
      chatTypingTimeouts.forEach((t) => clearTimeout(t));
      chatTypingTimeouts = [];
      container.innerHTML = "";

      let cumulativeDelay = 150;
      let activeTypingRow = createTypingBubbleDOM("introTypingRow");
      container.appendChild(activeTypingRow);

      CONFIG.chatMessages.forEach((msgText, idx) => {
        cumulativeDelay += 1100;
        const t = setTimeout(() => {
          if (activeTypingRow && activeTypingRow.parentNode) {
            activeTypingRow.remove();
          }

          const newMsg = { role: "partner", text: msgText };
          chatHistory.push(newMsg);
          container.appendChild(createMessageBubbleDOM(newMsg, true));

          const isLastIntroMsg = idx === CONFIG.chatMessages.length - 1;
          if (!isLastIntroMsg) {
            // Còn tin nhắn mở đầu tiếp theo -> hiện tiếp dấu 3 chấm (...)
            activeTypingRow = createTypingBubbleDOM("introTypingRow");
            container.appendChild(activeTypingRow);
          } else {
            // Đã gửi xong tin nhắn thứ 4 -> Kết thúc chuỗi mở đầu & Bật chế độ AI trả lời tự động
            introSequenceRunning = false;
            introSequenceCompleted = true;
            const statusEl = document.getElementById("chatAiStatusText");
            if (statusEl) {
              statusEl.textContent = "Đang hoạt động • Sẵn sàng trả lời em 💛";
            }
          }

          saveChatHistory();
          scrollChatToBottom();
        }, cumulativeDelay);

        chatTypingTimeouts.push(t);
      });
    }

    // Hàm gọi Gemini API (nếu có key) hoặc dùng bộ não phản hồi thông minh tích hợp sẵn
    async function fetchGeminiPartnerReply(userText) {
      const apiKey = (CONFIG.geminiApiKey || "").trim();
      if (apiKey) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const contents = chatHistory.slice(-12).map((item) => ({
          role: item.role === "user" ? "user" : "model",
          parts: [{ text: item.text }]
        }));

        const payload = {
          contents: contents,
          systemInstruction: {
            parts: [{ text: CONFIG.aiSystemPrompt }]
          }
        };

        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (response.ok) {
            const result = await response.json();
            const replyText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (replyText && replyText.trim()) {
              return replyText.trim();
            }
          }
        } catch (err) {
          // Chuyển sang bộ phản hồi nội bộ bên dưới
        }
      }

      return generateSmartLocalPartnerReply(userText);
    }

    // Bộ phản hồi AI tiếng Việt theo ngữ cảnh tình yêu & sinh nhật
    let lastFallbackIndex = -1;
    function generateSmartLocalPartnerReply(userText) {
      const raw = userText.trim();
      const lower = raw.toLowerCase();

      if (raw === "🤣" || lower.includes("haha") || lower.includes("hihi") || lower.includes("cười")) {
        return "Cười tươi thế này là anh yên tâm rồi, tuổi mới ngày nào cũng phải vui vẻ vậy nha em bé 🥰💞";
      }
      if (raw === "💛" || raw === "❤️" || raw === "💕" || lower.includes("thả tim")) {
        return "Bắn tim lại cho công chúa của anh nè 💛💖 Yêu em nhất trên đời luôn!";
      }
      if (raw === "🔥") {
        return "Cháy quá trời luôn 🔥 Sinh nhật năm nay quẩy tưng bừng với anh nhaaa 🎂🥳";
      }
      if (lower.includes("quà") || lower.includes("tặng gì") || lower.includes("đâu")) {
        return "Quà to bự nhất là tấm thân này kèm thêm một bất ngờ siêu xinh anh chuẩn bị sẵn cho em rồi đó, đoán xem là gì nào? 🎁😚";
      }
      if (lower.includes("cảm ơn") || lower.includes("cám ơn") || lower.includes("xúc động") || lower.includes("đáng yêu")) {
        return "Không có gì đâu em bé ơi 🥰 Chỉ cần nhìn thấy em cười hạnh phúc trong ngày sinh nhật là anh vui cả ngày rồi 💛";
      }
      if (lower.includes("yêu anh") || lower.includes("thương anh") || lower.includes("nhớ anh")) {
        return "Anh cũng yêu và thương em bé của anh nhiều lắm luôn á! Chúc công chúa của anh tuổi mới mọi điều tốt đẹp nhất 😚💓";
      }
      if (lower.includes("làm sao") || lower.includes("code") || lower.includes("web") || lower.includes("hay vậy")) {
        return "Anh thức tỉ mỉ chuẩn bị riêng cho em bé đó! Em thử bấm qua phần Lịch kỷ niệm với Bánh kem 3D xem chưa? 🎂✨";
      }
      if (lower.includes("làm gì") || lower.includes("ở đâu") || lower.includes("ăn chưa")) {
        return "Anh đang ngồi ngắm ảnh em bé trên Locket với chờ nhắn tin cùng nhân vật chính của ngày hôm nay nè 🥰💞";
      }
      if (lower.includes("nhiều không") || lower.includes("bao nhiêu") || lower.includes("mấy")) {
        return "Yêu em nhiều hơn cả bầu trời sao bên màn hình bánh kem 3D cộng lại luôn đó 🌌💛";
      }
      if (lower.includes("ảnh") || lower.includes("xinh") || lower.includes("đẹp")) {
        return "Tấm nào của em bé anh cũng mê hết trơn, ngắm hoài không biết chán luôn á 😍🌷";
      }
      if (lower.includes("ghét") || lower.includes("xạo") || lower.includes("điêu") || lower.includes("dỗi")) {
        return "Ơ kìa đừng dỗi mà 🥺 Anh nói thật lòng 100% từ trái tim luôn đó, thương em bé nhất màaa 😚💞";
      }

      const sweetReplies = [
        "Dạ anh nghe nè công chúa ơi 🥰 Hôm nay sinh nhật em nên em nói gì cũng đúng hết trơn á 💛",
        "Tuổi mới chúc em bé của anh luôn xinh đẹp, rạng rỡ và lúc nào cũng ở bên cạnh anh như bây giờ nha 🎂💞",
        "Em thử bấm vào nút tròn viền vàng ở giữa hoặc ngày 08/06 trong lịch để thổi nến sinh nhật 3D chưa nè? 🕯️✨",
        "Mọi ước nguyện tuổi mới của em bé đều sẽ thành hiện thực hết nha, vì lúc nào cũng có anh đồng hành cùng em rồi 🥰💛",
        "Nghe em nhắn thôi là thấy đáng yêu xỉu rồi 😚 Hôm nay công chúa muốn đi ăn món gì nhất để anh đưa đi nào? 🍰🍓"
      ];

      let pick = Math.floor(Math.random() * sweetReplies.length);
      if (pick === lastFallbackIndex) {
        pick = (pick + 1) % sweetReplies.length;
      }
      lastFallbackIndex = pick;
      return sweetReplies[pick];
    }

    // Xử lý khi người dùng gửi tin nhắn -> Hiển thị ngay & Kích hoạt AI trả lời tự động
    async function sendUserReply(text) {
      const cleaned = text.trim();
      if (!cleaned) return;

      const container = document.getElementById("chatMessagesContainer");

      // Nếu người dùng nhắn tin khi 4 câu đầu chưa chạy xong -> hoàn tất luôn các câu đầu
      if (introSequenceRunning) {
        chatTypingTimeouts.forEach((t) => clearTimeout(t));
        chatTypingTimeouts = [];
        const existingIntroTyping = document.getElementById("introTypingRow");
        if (existingIntroTyping) existingIntroTyping.remove();

        CONFIG.chatMessages.forEach((msgText) => {
          const alreadyAdded = chatHistory.some((m) => m.role === "partner" && m.text === msgText);
          if (!alreadyAdded) {
            const mObj = { role: "partner", text: msgText };
            chatHistory.push(mObj);
            container.appendChild(createMessageBubbleDOM(mObj, false));
          }
        });
        introSequenceRunning = false;
        introSequenceCompleted = true;
      }

      // 1. Thêm tin nhắn của người dùng vào lịch sử & giao diện
      const userMsgObj = { role: "user", text: cleaned };
      chatHistory.push(userMsgObj);
      container.appendChild(createMessageBubbleDOM(userMsgObj, true));
      saveChatHistory();
      scrollChatToBottom();
      spawnFloatingGiftsAndHearts(4);

      // 2. Hiển thị trạng thái đối phương đang gõ trả lời (...)
      const existingAiTyping = document.getElementById("aiPartnerTypingRow");
      if (existingAiTyping) existingAiTyping.remove();

      const aiTypingRow = createTypingBubbleDOM("aiPartnerTypingRow");
      container.appendChild(aiTypingRow);
      scrollChatToBottom();

      const statusEl = document.getElementById("chatAiStatusText");
      if (statusEl) statusEl.textContent = "Đang nhập tin nhắn...";

      // 3. Chờ tự nhiên + lấy phản hồi từ AI
      const minWait = new Promise((r) => setTimeout(r, 950));
      const [aiReplyText] = await Promise.all([
        fetchGeminiPartnerReply(cleaned),
        minWait
      ]);

      // 4. Xóa bong bóng (...) và hiển thị câu trả lời của "Người luôn yêu em"
      const currentTypingRow = document.getElementById("aiPartnerTypingRow");
      if (currentTypingRow) currentTypingRow.remove();

      const partnerMsgObj = { role: "partner", text: aiReplyText };
      chatHistory.push(partnerMsgObj);
      container.appendChild(createMessageBubbleDOM(partnerMsgObj, true));
      saveChatHistory();
      scrollChatToBottom();

      if (statusEl) statusEl.textContent = "Đang hoạt động 💛";
    }

    /* =========================================================================
       PHẦN 7: BÁNH KEM SINH NHẬT 3D XOAY 360° & PHÁO HOA BẦU TRỜI ĐÊM
       ========================================================================= */
    let cakeRotationY = 0;
    let cakeAnimFrame = null;
    let isDraggingCake = false;
    let prevPointerX = 0;

    function build3DBirthdayCake() {
      const topTier = document.getElementById("cakeTopTier");
      const bottomTier = document.getElementById("cakeBottomTier");
      topTier.innerHTML = "";
      bottomTier.innerHTML = "";

      // Tầng trên: 8 tấm ảnh xếp thành hình trụ tròn
      const topSegments = 8;
      const topRadius = 68;
      const topWidth = 56;
      const topHeight = 95;

      const topLid = document.createElement("div");
      topLid.className = "cake-lid";
      topLid.style.width = `${topRadius * 2}px`;
      topLid.style.height = `${topRadius * 2}px`;
      topLid.style.left = `${-topRadius}px`;
      topLid.style.top = `${-topRadius}px`;
      topLid.innerHTML = `<img src="${CONFIG.photos[0].url}" class="w-full h-full object-cover opacity-85" />`;
      topTier.appendChild(topLid);

      for (let i = 0; i < topSegments; i++) {
        const angle = (360 / topSegments) * i;
        const photo = CONFIG.photos[i % CONFIG.photos.length];
        const panel = document.createElement("div");
        panel.className = "cake-panel";
        panel.style.width = `${topWidth}px`;
        panel.style.height = `${topHeight}px`;
        panel.style.marginLeft = `${-topWidth / 2}px`;
        panel.style.transform = `rotateY(${angle}deg) translateZ(${topRadius}px)`;
        panel.innerHTML = `<img src="${photo.url}" alt="Cake Top ${i}" />`;
        topTier.appendChild(panel);
      }

      // Tầng dưới: 12 tấm ảnh xếp thành hình trụ tròn lớn
      const bottomSegments = 12;
      const bottomRadius = 118;
      const bottomWidth = 64;
      const bottomHeight = 118;

      const bottomLid = document.createElement("div");
      bottomLid.className = "cake-lid";
      bottomLid.style.width = `${bottomRadius * 2}px`;
      bottomLid.style.height = `${bottomRadius * 2}px`;
      bottomLid.style.left = `${-bottomRadius}px`;
      bottomLid.style.top = `${-bottomRadius}px`;
      bottomLid.innerHTML = `<img src="${CONFIG.photos[1 % CONFIG.photos.length].url}" class="w-full h-full object-cover opacity-80" />`;
      bottomTier.appendChild(bottomLid);

      for (let i = 0; i < bottomSegments; i++) {
        const angle = (360 / bottomSegments) * i;
        const photo = CONFIG.photos[(i + 3) % CONFIG.photos.length];
        const panel = document.createElement("div");
        panel.className = "cake-panel";
        panel.style.width = `${bottomWidth}px`;
        panel.style.height = `${bottomHeight}px`;
        panel.style.marginLeft = `${-bottomWidth / 2}px`;
        panel.style.transform = `rotateY(${angle}deg) translateZ(${bottomRadius}px)`;
        panel.innerHTML = `<img src="${photo.url}" alt="Cake Bottom ${i}" />`;
        bottomTier.appendChild(panel);
      }
    }

    // Hệ thống Pháo Hoa & Bầu Trời Đầy Sao trên Canvas
    const fwCanvas = document.getElementById("fireworksCanvas");
    const fwCtx = fwCanvas.getContext("2d");
    let stars = [];
    let fireworks = [];
    let isCakeScreenActive = false;

    function resizeFireworksCanvas() {
      const frame = document.getElementById("appFrame");
      fwCanvas.width = frame.clientWidth || 400;
      fwCanvas.height = frame.clientHeight || 800;

      stars = Array.from({ length: 85 }, () => ({
        x: Math.random() * fwCanvas.width,
        y: Math.random() * fwCanvas.height,
        r: Math.random() * 1.7 + 0.4,
        alpha: Math.random(),
        speed: Math.random() * 0.02 + 0.005
      }));
    }

    function createFireworkBurst(x, y) {
      const colors = ["#facc15", "#fb7185", "#38bdf8", "#4ade80", "#c084fc", "#f97316", "#ffffff"];
      const particles = [];
      const count = 32;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.2;
        const speed = 1.5 + Math.random() * 3.2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          size: 2 + Math.random() * 2
        });
      }
      fireworks.push(...particles);
    }

    function startCake3DAnimation() {
      if (isCakeScreenActive) return;
      isCakeScreenActive = true;
      resizeFireworksCanvas();
      createFireworkBurst(fwCanvas.width * 0.25, fwCanvas.height * 0.28);
      setTimeout(() => createFireworkBurst(fwCanvas.width * 0.78, fwCanvas.height * 0.35), 400);

      const cakeObj = document.getElementById("cake3DObject");

      function animateLoop() {
        if (!isCakeScreenActive) return;

        if (!isDraggingCake) {
          cakeRotationY -= 0.45;
        }
        cakeObj.style.transform = `rotateX(-13deg) rotateY(${cakeRotationY}deg)`;

        fwCtx.fillStyle = "rgba(4, 7, 17, 0.28)";
        fwCtx.fillRect(0, 0, fwCanvas.width, fwCanvas.height);

        stars.forEach((s) => {
          s.alpha += s.speed;
          const opacity = 0.3 + Math.abs(Math.sin(s.alpha)) * 0.7;
          fwCtx.beginPath();
          fwCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          fwCtx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          fwCtx.fill();
        });

        if (Math.random() < 0.035) {
          createFireworkBurst(
            40 + Math.random() * (fwCanvas.width - 80),
            60 + Math.random() * (fwCanvas.height * 0.55)
          );
        }

        for (let i = fireworks.length - 1; i >= 0; i--) {
          const p = fireworks[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.035;
          p.alpha -= 0.016;

          if (p.alpha <= 0) {
            fireworks.splice(i, 1);
            continue;
          }

          fwCtx.beginPath();
          fwCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          fwCtx.fillStyle = p.color;
          fwCtx.globalAlpha = Math.max(0, p.alpha);
          fwCtx.fill();
          fwCtx.globalAlpha = 1;
        }

        cakeAnimFrame = requestAnimationFrame(animateLoop);
      }

      cakeAnimFrame = requestAnimationFrame(animateLoop);
    }

    function stopCake3DAnimation() {
      isCakeScreenActive = false;
      if (cakeAnimFrame) cancelAnimationFrame(cakeAnimFrame);
    }

    // Cho phép người dùng vuốt ngang để xoay Bánh Kem 3D & chạm để bắn pháo hoa
    const cakeTouchArea = document.getElementById("cakeTouchArea");
    cakeTouchArea.addEventListener("pointerdown", (e) => {
      isDraggingCake = true;
      prevPointerX = e.clientX;
      const rect = fwCanvas.getBoundingClientRect();
      createFireworkBurst(e.clientX - rect.left, e.clientY - rect.top);
    });
    window.addEventListener("pointermove", (e) => {
      if (!isDraggingCake) return;
      const deltaX = e.clientX - prevPointerX;
      prevPointerX = e.clientX;
      cakeRotationY += deltaX * 0.65;
    });
    window.addEventListener("pointerup", () => {
      isDraggingCake = false;
    });

    /* =========================================================================
       PHẦN 8: KẾT NỐI TOÀN BỘ SỰ KIỆN NÚT BẤM & TẢI ẢNH TỪ THIẾT BỊ
       ========================================================================= */
    // 1. Nút Trái Tim Vàng ở màn hình mở đầu
    document.getElementById("btnStartIntro").addEventListener("click", () => {
      startRomanticMusic();
      showScreen("screenMainGrid");
    });

    // 2. Nút Bật/Tắt nhạc nền & Nút Mở Rollcall (MỚI)
    document.getElementById("btnToggleMusic").addEventListener("click", toggleMusic);
    document.getElementById("btnOpenRollcall").addEventListener("click", () => {
      showScreen("screenRollcall", true);
    });
    document.getElementById("btnViewerOpenRollcall").addEventListener("click", () => {
      showScreen("screenRollcall", true);
    });
    document.getElementById("btnCloseRollcall").addEventListener("click", () => {
      closeModal("screenRollcall");
    });

    // 3. Nút "Tất cả bạn bè" -> Mở hộp thoại chọn ảnh từ thiết bị hoặc đổi kiểu lưới
    document.getElementById("btnPeopleFilter").addEventListener("click", () => {
      showScreen("modalCustomPhotos", true);
    });
    document.getElementById("btnViewerPeopleFilter").addEventListener("click", () => {
      showScreen("modalCustomPhotos", true);
    });
    document.getElementById("btnToggleStackedGrid").addEventListener("click", () => {
      isStackedGridMode = !isStackedGridMode;
      renderPhotoGrid();
      closeModal("modalCustomPhotos");
    });
    document.getElementById("btnCloseCustomModal").addEventListener("click", () => {
      closeModal("modalCustomPhotos");
    });
    document.getElementById("btnOpenCakeFromMenu").addEventListener("click", () => {
      closeModal("modalCustomPhotos");
      showScreen("screenCake3D", true);
    });
    document.getElementById("btnTriggerFileUpload").addEventListener("click", () => {
      document.getElementById("customPhotoInput").click();
    });

    // Xử lý khi người dùng chọn ảnh từ điện thoại/máy tính
    document.getElementById("customPhotoInput").addEventListener("change", (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const defaultCaptions = [
        "So sweet! 💕",
        "Always together 💞",
        "Love you! 💓",
        "Life is good 🌈",
        "Look at this!",
        "Always together 🫐",
        "Happy Birthday 🎂",
        "My Princess 👑"
      ];

      const uploadedPhotos = files.map((file, idx) => ({
        url: URL.createObjectURL(file),
        caption: defaultCaptions[idx % defaultCaptions.length]
      }));

      let combined = [...uploadedPhotos];
      while (combined.length < 12) {
        combined = combined.concat(uploadedPhotos);
      }
      CONFIG.photos = combined.slice(0, Math.max(15, uploadedPhotos.length));

      initAppUI();
      closeModal("modalCustomPhotos");
    });

    // 4. Nút tròn viền Vàng Locket chính giữa & Avatar góc trên -> Mở Bánh Kem 3D
    document.getElementById("btnCenterLocket").addEventListener("click", () => {
      showScreen("screenCake3D", true);
    });
    document.getElementById("btnProfileAvatar").addEventListener("click", () => {
      showScreen("screenCake3D", true);
    });
    document.getElementById("btnCloseCake3D").addEventListener("click", () => {
      closeModal("screenCake3D");
    });

    // 5. Các nút trong màn hình Xem Ảnh Chi Tiết (Chuẩn Locket + Slideshow)
    document.getElementById("btnCloseViewer").addEventListener("click", () => {
      closeModal("screenPhotoViewer");
    });
    document.getElementById("btnAutoPlayToggle").addEventListener("click", toggleAutoPlaySlideshow);
    document.getElementById("btnSendPaperPlane").addEventListener("click", () => {
      spawnFloatingGiftsAndHearts(9);
      nextPhotoSlide();
    });
    document.getElementById("btnNextThumb").addEventListener("click", nextPhotoSlide);
    document.getElementById("btnDownloadPhoto").addEventListener("click", () => {
      spawnFloatingGiftsAndHearts(8);
    });

    // Chạm hoặc vuốt trái/phải trên khung ảnh để chuyển ảnh mượt mà
    let touchStartX = 0;
    const viewerCardArea = document.getElementById("viewerCardArea");
    viewerCardArea.addEventListener("pointerdown", (e) => {
      touchStartX = e.clientX;
    });
    viewerCardArea.addEventListener("pointerup", (e) => {
      const diff = e.clientX - touchStartX;
      if (Math.abs(diff) > 35) {
        if (diff < 0) nextPhotoSlide();
        else prevPhotoSlide();
      } else {
        spawnFloatingGiftsAndHearts(6);
        nextPhotoSlide();
      }
    });

    // Các nút trên thanh Dock dưới của màn hình Xem ảnh đơn
    document.getElementById("btnViewerOpenCalendar").addEventListener("click", () => {
      showScreen("screenCalendar", true);
    });
    document.getElementById("btnViewerOpenCake").addEventListener("click", () => {
      showScreen("screenCake3D", true);
    });
    document.getElementById("btnViewerOpenChat").addEventListener("click", () => {
      updateInboxPreviewText();
      showScreen("screenChatList");
    });

    // Bấm cảm xúc hoặc gửi tin nhắn ngay dưới bức ảnh Locket
    document.querySelectorAll(".viewer-react-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        spawnFloatingGiftsAndHearts(8);
        sendUserReply(btn.dataset.emoji);
      });
    });
    const viewerQuickInput = document.getElementById("viewerQuickInput");
    viewerQuickInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && viewerQuickInput.value.trim()) {
        e.preventDefault();
        const msg = viewerQuickInput.value.trim();
        viewerQuickInput.value = "";
        spawnFloatingGiftsAndHearts(7);
        sendUserReply(msg);
        showScreen("screenChatRoom");
        openChatRoomAndEnsureState();
      }
    });

    // 6. Sự kiện Lịch Kỷ Niệm
    document.getElementById("btnOpenCalendar").addEventListener("click", () => {
      showScreen("screenCalendar", true);
    });
    document.getElementById("btnCloseCalendar").addEventListener("click", () => {
      closeModal("screenCalendar");
    });

    // 7. Sự kiện Trò Chuyện (Chat) - Giữ nguyên đoạn chat khi thoát ra vào lại
    document.getElementById("btnOpenChatList").addEventListener("click", () => {
      updateInboxPreviewText();
      showScreen("screenChatList");
    });
    document.getElementById("btnCloseChatList").addEventListener("click", () => {
      closeModal("screenChatList");
    });
    document.getElementById("btnChatDockCalendar").addEventListener("click", () => {
      closeModal("screenChatList");
      showScreen("screenCalendar", true);
    });
    document.getElementById("btnNewChatCompose").addEventListener("click", () => {
      showScreen("screenChatRoom");
      openChatRoomAndEnsureState();
    });
    document.getElementById("btnOpenConversation").addEventListener("click", () => {
      showScreen("screenChatRoom");
      openChatRoomAndEnsureState();
    });
    document.getElementById("btnBackToChatList").addEventListener("click", () => {
      updateInboxPreviewText();
      closeModal("screenChatRoom");
    });

    // Nút phát lại đoạn chat từ đầu (chỉ khi người dùng chủ động bấm icon xoay ở góc trên phải)
    document.getElementById("btnResetChatHistory").addEventListener("click", () => {
      chatTypingTimeouts.forEach((t) => clearTimeout(t));
      chatTypingTimeouts = [];
      chatHistory = [];
      introSequenceCompleted = false;
      introSequenceRunning = false;
      try {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      } catch (e) {}
      updateInboxPreviewText();
      openChatRoomAndEnsureState();
    });

    // Đổi icon nút gửi khi người dùng nhập chữ
    const chatInputBox = document.getElementById("chatInputBox");
    const sendBtnIcon = document.getElementById("sendBtnIcon");

    chatInputBox.addEventListener("input", () => {
      if (chatInputBox.value.trim().length > 0) {
        sendBtnIcon.className = "fa-solid fa-paper-plane text-yellow-400";
      } else {
        sendBtnIcon.className = "fa-regular fa-face-smile";
      }
    });

    // Gửi tin nhắn bằng phím Enter hoặc nút Gửi
    chatInputBox.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = chatInputBox.value;
        if (text.trim()) {
          chatInputBox.value = "";
          sendBtnIcon.className = "fa-regular fa-face-smile";
          sendUserReply(text);
        }
      }
    });
    document.getElementById("btnSendUserMsg").addEventListener("click", () => {
      if (chatInputBox.value.trim()) {
        const text = chatInputBox.value;
        chatInputBox.value = "";
        sendBtnIcon.className = "fa-regular fa-face-smile";
        sendUserReply(text);
      } else {
        spawnFloatingGiftsAndHearts(6);
      }
    });
    document.querySelectorAll(".emoji-react-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        sendUserReply(btn.dataset.emoji);
      });
    });

    // Khởi chạy ứng dụng khi tải trang xong
    window.onload = () => {
      initAppUI();
    };
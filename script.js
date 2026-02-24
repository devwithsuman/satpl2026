// --- SATPL 2026 Registration Script ---

document.addEventListener("DOMContentLoaded", () => {
    const registrationForm = document.getElementById("registrationForm");
    const formMessage = document.getElementById("formMessage");
    const submitBtn = document.getElementById("submitBtn");
    const RAZORPAY_KEY_ID = "rzp_live_SGk0djRkKJ1Uft";

    const mobileInput = document.getElementById("mobileInput");
    const aadharInput = document.getElementById("aadharInput");
    const mobileError = document.getElementById("mobileError");
    const aadharError = document.getElementById("aadharError");

    const photoInput = document.getElementById("photoInput");
    const photoError = document.getElementById("photoError");

    // --- REAL-TIME VALIDATION ---
    async function checkDuplicate(field, value, errorElement) {
        if (!value || value.length < 10) return;

        try {
            const { data, error } = await supabaseClient
                .from("player_registrations")
                .select("id")
                .eq(field, value)
                .maybeSingle();

            if (data) {
                errorElement.innerText = `This ${field.replace("_", " ")} is already registered!`;
                errorElement.style.display = "block";
                submitBtn.disabled = true;
            } else {
                errorElement.style.display = "none";
                validateForm();
            }
        } catch (err) {
            console.warn("Validation Error:", err.message);
        }
    }

    function validateForm() {
        const hasMobileError = mobileError ? mobileError.style.display === "block" : false;
        const hasAadharError = aadharError ? aadharError.style.display === "block" : false;
        const hasPhotoError = photoError ? photoError.style.display === "block" : false;

        if (!hasMobileError && !hasAadharError && !hasPhotoError) {
            submitBtn.disabled = false;
        } else {
            submitBtn.disabled = true;
        }
    }

    if (mobileInput) {
        mobileInput.addEventListener("blur", () => checkDuplicate("mobile_number", mobileInput.value, mobileError));
    }
    if (aadharInput) {
        aadharInput.addEventListener("blur", () => checkDuplicate("aadhar_number", aadharInput.value, aadharError));
    }

    if (photoInput) {
        photoInput.addEventListener("change", function () {
            const file = this.files[0];
            if (file) {
                const ext = file.name.split('.').pop().toLowerCase();
                if (!['jpg', 'jpeg', 'pdf'].includes(ext)) {
                    photoError.innerText = "Error: Only JPG or PDF files are allowed!";
                    photoError.style.display = "block";
                    submitBtn.disabled = true;
                } else {
                    photoError.style.display = "none";
                    validateForm();
                }
            }
        });
    }

    if (registrationForm) {
        registrationForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            // Final sanity check
            if (mobileError.style.display === "block" || aadharError.style.display === "block" || photoError.style.display === "block") {
                alert("Please fix the errors before proceeding.");
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerText = "⏳ Redirecting to Secure Payment...";
            formMessage.innerText = "";

            const formData = new FormData(registrationForm);
            const mobile = formData.get("mobile");
            const aadhar = formData.get("aadhar");
            const playerName = formData.get("playerName");
            const photo = formData.get("playerPhoto");

            try {
                // 0️⃣ Final check for duplicates before anything
                const { data: existingPlayer } = await supabaseClient
                    .from("player_registrations")
                    .select("id")
                    .or(`mobile_number.eq.${mobile},aadhar_number.eq.${aadhar}`)
                    .maybeSingle();

                if (existingPlayer) {
                    formMessage.style.color = "#ff4d8d";
                    formMessage.innerText = "Error: This Mobile or Aadhar is already registered!";
                    submitBtn.disabled = false;
                    submitBtn.innerText = "Proceed to Payment (₹105)";
                    return;
                }

                // Photo Size Check (5MB)
                if (photo && photo.size > 5 * 1024 * 1024) {
                    alert("Photo size must be less than 5MB");
                    submitBtn.disabled = false;
                    submitBtn.innerText = "Proceed to Payment (₹105)";
                    return;
                }

                submitBtn.innerText = "⏳ Saving Details...";
                const playerToken = Math.random().toString(36).substring(2, 7) + Math.random().toString(36).substring(2, 7);

                // 1️⃣ Upload Photo
                const timestamp = Date.now();
                const ext = photo.name ? photo.name.split('.').pop() : 'jpg';
                const fileName = `player_${timestamp}_${Math.floor(Math.random() * 1000)}.${ext}`;

                const { error: uploadError } = await supabaseClient.storage
                    .from("player-photos")
                    .upload(fileName, photo);

                if (uploadError) throw new Error("Photo Upload Failed: " + uploadError.message);

                const { data: photoData } = supabaseClient.storage
                    .from("player-photos")
                    .getPublicUrl(fileName);

                const photoUrl = photoData.publicUrl;

                // 2️⃣ Save as PENDING record first
                const { data: insertedData, error: insertError } = await supabaseClient
                    .from("player_registrations")
                    .insert([{
                        player_name: playerName,
                        father_name: formData.get("fatherName"),
                        date_of_birth: formData.get("dob"),
                        aadhar_number: aadhar,
                        mobile_number: mobile,
                        whatsapp_number: formData.get("whatsapp"),
                        batting: formData.get("batting"),
                        bowling: formData.get("bowling"),
                        wicket_keeper: formData.get("wicketKeeper"),
                        photo_url: photoUrl,
                        payment_status: "pending",
                        payment_id: "PENDING_CHECKOUT",
                        token: playerToken
                    }])
                    .select();

                if (insertError) throw new Error("Database Save Failed: " + insertError.message);

                const playerRow = insertedData[0];
                const playerId = playerRow.id;
                const serialNum = parseInt(playerRow.reg_serial);

                // 3️⃣ Open Razorpay
                const options = {
                    key: RAZORPAY_KEY_ID,
                    amount: 105 * 100, // ₹105
                    currency: "INR",
                    name: "SATPL 2026",
                    description: "Player Registration Fee",
                    image: "IMG.svg", // Use the localized IMG.svg logo
                    prefill: {
                        name: playerName,
                        contact: mobile,
                        email: "player@satpl.com" // Placeholder to trigger standard flow
                    },
                    notes: {
                        aadhar: aadhar,
                        db_row_id: playerId
                    },
                    theme: {
                        color: "#ff0000"
                    },
                    config: {
                        display: {
                            blocks: {
                                utp: {
                                    name: "Mobile Verified Payment",
                                    instruments: [{ method: "upi" }, { method: "card" }, { method: "netbanking" }]
                                }
                            },
                            sequence: ["block.utp"],
                            preferences: { show_default_blocks: true }
                        }
                    },
                    handler: async function (response) {
                        try {
                            console.log("💳 Payment successful! ID:", response.razorpay_payment_id);
                            submitBtn.innerText = "⏳ Finalizing Registration...";
                            submitBtn.disabled = true;

                            // Generate Reg No (using existing reg_serial)
                            if (isNaN(serialNum)) {
                                throw new Error("ID Generation Error: Serial number is invalid.");
                            }
                            const registrationNo = `OSATPL01S${(serialNum + 2000).toString().padStart(4, "0")}`;
                            console.log("📝 Generated Registration No:", registrationNo);

                            // Update to PAID
                            const { data: updateData, error: updateError } = await supabaseClient
                                .from("player_registrations")
                                .update({
                                    payment_status: "paid",
                                    payment_id: response.razorpay_payment_id,
                                    registration_no: registrationNo
                                })
                                .eq("id", playerId)
                                .select();

                            if (updateError) {
                                console.error("❌ Supabase Update Error:", updateError);
                                throw new Error("Reg No Generation Failed: " + updateError.message);
                            }

                            console.log("✅ Registration finalized successfully:", updateData);
                            window.location.href = `success.html?id=${playerToken}`;

                        } catch (error) {
                            console.error("🚨 Payment Handler Error:", error);
                            alert("Payment Successful, but we had trouble updating our records automatically.\nPlease take a screenshot of your Payment ID: " + response.razorpay_payment_id + "\nError: " + error.message);

                            const registrationNoFallback = `OSATPL01S${(serialNum + 2000).toString().padStart(4, "0")}`;
                            window.location.href = `success.html?reg_no=${registrationNoFallback}&error=sync_failed`;
                        }
                    },
                    modal: {
                        ondismiss: function () {
                            submitBtn.disabled = false;
                            submitBtn.innerText = "Proceed to Payment (₹105)";
                            formMessage.style.color = "#eab308";
                            formMessage.innerText = "Payment cancelled. Your details are saved as 'Pending'.";
                        }
                    }
                };

                const rzp = new Razorpay(options);
                rzp.open();

            } catch (err) {
                console.error("Submission Error:", err);
                alert("Error: " + err.message);
                submitBtn.disabled = false;
                submitBtn.innerText = "Proceed to Payment (₹105)";
            }
        });
    }

    // --- REGISTRATION STATUS LOOKUP ---
    const checkStatusBtn = document.getElementById("checkStatusBtn");
    const statusResult = document.getElementById("statusResult");

    if (checkStatusBtn) {
        checkStatusBtn.addEventListener("click", async () => {
            const mobile = document.getElementById("statusMobile").value.trim();
            const aadhar = document.getElementById("statusAadhar").value.trim();

            if (!mobile || !aadhar) {
                alert("Please enter both Mobile and Aadhar numbers.");
                return;
            }

            checkStatusBtn.disabled = true;
            checkStatusBtn.innerText = "⏳ Searching Database...";
            statusResult.style.display = "none";

            console.log(`Checking status for Mobile: ${mobile}, Aadhar: ${aadhar}`);

            try {
                // We use .select() instead of .maybeSingle() first to see if there are duplicates
                const { data, error } = await supabaseClient
                    .from("player_registrations")
                    .select("player_name, registration_no, payment_status, token")
                    .eq("mobile_number", mobile)
                    .eq("aadhar_number", aadhar);

                if (error) {
                    console.error("Supabase Error:", error);
                    throw new Error(error.message);
                }

                statusResult.style.display = "block";

                if (data && data.length > 0) {
                    // Use the first match
                    const player = data[0];
                    console.log("Player found:", player);

                    const isPaid = player.payment_status === 'paid';
                    const downloadBtn = isPaid && (player.token || player.registration_no)
                        ? `<a href="success.html?id=${player.token || player.registration_no}" class="btn" style="display: block; margin-top: 20px; text-decoration: none;">Download Digital ID Card 📥</a>`
                        : '';

                    statusResult.innerHTML = `
                        <div style="text-align: center;">
                            <p style="color: #00ffa3; font-weight: bold; margin-bottom: 10px;">✅ Registration Found!</p>
                            <h4 style="margin-bottom: 15px; color: #fff; font-size: 1.1rem;">${player.player_name}</h4>
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <p style="font-size: 0.8rem; color: #aaa; margin-bottom: 5px;">Registration Number</p>
                                <p style="font-size: 1.2rem; color: #ff0000; font-family: monospace; font-weight: bold;">${player.registration_no || "PROCESSING PAYMENT..."}</p>
                            </div>
                            <p style="margin-top: 15px; font-size: 0.9rem;">Payment Status: <strong style="color: ${isPaid ? '#00ffa3' : '#ff4d8d'}">${player.payment_status.toUpperCase()}</strong></p>
                            ${downloadBtn}
                        </div>
                    `;
                } else {
                    console.warn("No player found with these credentials.");
                    statusResult.innerHTML = `
                        <div style="text-align: center; color: #ff4d8d; padding: 10px;">
                            <p>❌ No registration found.</p>
                            <p style="font-size: 0.8rem; margin-top: 10px; color: #aaa;">Please double-check your Mobile and Aadhar numbers.</p>
                        </div>
                    `;
                }
            } catch (err) {
                console.error("Lookup Failed:", err);
                alert("Lookup Error: " + err.message + "\n(Check if your live site domain is allowed in Supabase)");
            } finally {
                checkStatusBtn.disabled = false;
                checkStatusBtn.innerText = "Fetch My Registration Details 🔍";
            }
        });
    }

    // --- REGISTRATION COUNTDOWN ---
    function startRegistrationCountdown() {
        const targetDate = new Date("February 27, 2026 18:00:00").getTime();
        const marqueeEl = document.getElementById("registrationCountdownMarquee");

        if (!marqueeEl) return;

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetDate - now;

            if (distance < 0) {
                clearInterval(timer);
                marqueeEl.innerHTML = "🚫 REGISTRATION CLOSED - SONAIJURI ANCHAL TENNIS PREMIER LEAGUE 2026";
                marqueeEl.style.color = "#ff4d8d";

                // Disable form
                if (registrationForm) {
                    const inputs = registrationForm.querySelectorAll('input, select, button');
                    inputs.forEach(input => input.disabled = true);
                    submitBtn.innerText = "Registration Closed";
                    submitBtn.style.opacity = "0.5";
                    submitBtn.classList.remove('btn-red-blink');
                }
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            marqueeEl.innerHTML = `🚀 Registration is closing soon! Time Remaining: ${days}d ${hours}h ${minutes}m ${seconds}s - SONAIJURI ANCHAL TENNIS PREMIER LEAGUE 2026`;
        }, 1000);
    }

    startRegistrationCountdown();
});

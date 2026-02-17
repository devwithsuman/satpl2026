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
                // 0️⃣ Final check for duplicates before payment
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

                const options = {
                    key: RAZORPAY_KEY_ID,
                    amount: 105 * 100, // ₹105
                    currency: "INR",
                    name: "SATPL 2026",
                    description: "Player Registration Fee",
                    image: "https://satpl-2026.vercel.app/logo.png", // Attempt to use a logo if available
                    prefill: {
                        name: playerName,
                        contact: mobile,
                        email: "player@satpl.com" // Placeholder to trigger standard flow
                    },
                    notes: {
                        aadhar: aadhar
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
                            submitBtn.innerText = "⏳ Finalizing Registration...";
                            // 1️⃣ Upload Photo
                            const timestamp = Date.now();
                            const ext = photo.name ? photo.name.split('.').pop() : 'jpg';
                            const fileName = `player_${timestamp}_${Math.floor(Math.random() * 1000)}.${ext}`;

                            const { error: uploadError } = await supabaseClient.storage
                                .from("player-photos")
                                .upload(fileName, photo);

                            if (uploadError) throw new Error("Photo Upload Failed: " + uploadError.message);

                            const { data } = supabaseClient.storage
                                .from("player-photos")
                                .getPublicUrl(fileName);

                            const photoUrl = data.publicUrl;

                            // 2️⃣ Save Data
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
                                    payment_status: "paid",
                                    payment_id: response.razorpay_payment_id
                                }])
                                .select();

                            if (insertError) throw new Error("Database Save Failed: " + insertError.message);

                            // 3️⃣ Generate Reg No
                            const serial = insertedData[0].reg_serial || insertedData[0].id;
                            const registrationNo = `OSATPL01S${(serial + 2000).toString().padStart(4, "0")}`;

                            const { error: updateError } = await supabaseClient
                                .from("player_registrations")
                                .update({ registration_no: registrationNo })
                                .eq("id", insertedData[0].id);

                            if (updateError) throw new Error("Reg No Generation Failed: " + updateError.message);

                            window.location.href = `success.html?reg_no=${registrationNo}`;

                        } catch (error) {
                            console.error("Save Error:", error);
                            alert("Registration Error: " + error.message);
                            submitBtn.disabled = false;
                            submitBtn.innerText = "Proceed to Payment (₹105)";
                        }
                    },
                    modal: {
                        ondismiss: function () {
                            submitBtn.disabled = false;
                            submitBtn.innerText = "Proceed to Payment (₹105)";
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
            const mobile = document.getElementById("statusMobile").value;
            const aadhar = document.getElementById("statusAadhar").value;

            if (!mobile || !aadhar) {
                alert("Please enter both Mobile and Aadhar numbers.");
                return;
            }

            checkStatusBtn.disabled = true;
            checkStatusBtn.innerText = "⏳ Searching...";
            statusResult.style.display = "none";

            try {
                const { data, error } = await supabaseClient
                    .from("player_registrations")
                    .select("player_name, registration_no, payment_status")
                    .eq("mobile_number", mobile)
                    .eq("aadhar_number", aadhar)
                    .maybeSingle();

                if (error) throw error;

                statusResult.style.display = "block";
                if (data) {
                    statusResult.innerHTML = `
                        <div style="text-align: center;">
                            <p style="color: var(--secondary); font-weight: bold; margin-bottom: 10px;">✅ Registration Found!</p>
                            <h4 style="margin-bottom: 15px; color: #fff; font-size: 1.1rem;">${data.player_name}</h4>
                            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                                <p style="font-size: 0.8rem; color: var(--text-dim); margin-bottom: 5px;">Registration Number</p>
                                <p style="font-size: 1.2rem; color: var(--primary); font-family: monospace; font-weight: bold;">${data.registration_no || "Pending Payment"}</p>
                            </div>
                            <p style="margin-top: 15px; font-size: 0.8rem;">Status: <span style="color: ${data.payment_status === 'paid' ? '#00ffa3' : '#ff4d8d'}">${data.payment_status.toUpperCase()}</span></p>
                        </div>
                    `;
                } else {
                    statusResult.innerHTML = `
                        <div style="text-align: center; color: #ff4d8d;">
                            <p>❌ No registration found for these details.</p>
                            <p style="font-size: 0.8rem; margin-top: 10px; color: var(--text-dim);">Please check the numbers and try again.</p>
                        </div>
                    `;
                }
            } catch (err) {
                alert("Error searching registration: " + err.message);
            } finally {
                checkStatusBtn.disabled = false;
                checkStatusBtn.innerText = "Fetch My Registration Details 🔍";
            }
        });
    }
});

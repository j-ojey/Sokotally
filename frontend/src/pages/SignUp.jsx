import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const SignUp = () => {
  const { signUp, loading, error } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    password: "",
    confirm: "",
    agreeToTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const validatePhone = (phone) => {
    const phoneRegex = /^(\+254|254|0)?[17]\d{8}$/;
    return phoneRegex.test(phone.replace(/\s/g, ""));
  };

  const validatePassword = (password) => {
    return password.length >= 8;
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors({ ...validationErrors, [name]: "" });
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!form.firstName.trim()) errors.firstName = "First name is required";
    if (!form.lastName.trim()) errors.lastName = "Last name is required";
    if (!form.phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (!validatePhone(form.phone)) {
      errors.phone = "Please enter a valid phone number";
    }
    if (!form.password) {
      errors.password = "Password is required";
    } else if (!validatePassword(form.password)) {
      errors.password = "Password must be at least 8 characters";
    }
    if (!form.confirm) {
      errors.confirm = "Please confirm your password";
    } else if (form.password !== form.confirm) {
      errors.confirm = "Passwords do not match";
    }
    if (!form.agreeToTerms) {
      errors.terms = "You must agree to the terms to continue";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      await signUp({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      navigate("/signin");
    } catch (err) {
      console.error("Signup error:", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6 relative">
      {/* Back to Home */}
      <div className="fixed top-0 left-0 right-0 p-6 z-50">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-700 dark:text-slate-200 font-semibold text-base px-4 py-2 hover:text-gray-900 dark:hover:text-white transition-all duration-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to Home
        </Link>
      </div>

      {/* Form Card */}
      <form
        onSubmit={onSubmit}
        className="bg-white dark:bg-slate-900 p-10 w-full max-w-md shadow-sm relative z-10 border border-gray-200 dark:border-slate-800"
      >
        {/* Logo Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
            SokoTally
          </h1>
          <p className="text-gray-600 dark:text-slate-300 text-sm">
            Join SokoTally to start tracking your business
          </p>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
          Create your account
        </h2>{" "}
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 mb-6 text-sm border border-red-200">
            <span>{error}</span>
          </div>
        )}
        {/* Name Row */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <label className="block">
            <span className="block mb-2 font-semibold text-gray-700 dark:text-slate-200 text-sm">
              First Name
            </span>
            <input
              name="firstName"
              value={form.firstName}
              onChange={onChange}
              placeholder="John"
              className={`w-full px-4 py-3 border text-base transition-all duration-200 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 ${
                validationErrors.firstName
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-gray-300 dark:border-slate-700 focus:border-gray-900 dark:focus:border-white focus:ring-1 focus:ring-gray-900/10"
              }`}
            />
            {validationErrors.firstName && (
              <span className="text-red-400 text-sm font-light mt-2">
                {validationErrors.firstName}
              </span>
            )}
          </label>
          <label className="block">
            <span className="block mb-2 font-semibold text-gray-700 dark:text-slate-200 text-sm">
              Last Name
            </span>
            <input
              name="lastName"
              value={form.lastName}
              onChange={onChange}
              placeholder="Doe"
              className={`w-full px-4 py-3 border text-base transition-all duration-200 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 ${
                validationErrors.lastName
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-gray-300 dark:border-slate-700 focus:border-gray-900 dark:focus:border-white focus:ring-1 focus:ring-gray-900/10"
              }`}
            />
            {validationErrors.lastName && (
              <span className="text-red-400 text-sm font-light mt-2">
                {validationErrors.lastName}
              </span>
            )}
          </label>
        </div>
        {/* Phone */}
        <label className="block mb-5">
          <span className="block mb-2 font-semibold text-gray-700 dark:text-slate-200 text-sm">
            Phone Number
          </span>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={onChange}
            placeholder="0712345678 or +254712345678"
            className={`w-full px-4 py-3 border text-base transition-all duration-200 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 ${
              validationErrors.phone
                ? "border-red-500/50 focus:border-red-500"
                : "border-gray-300 dark:border-slate-700 focus:border-gray-900 dark:focus:border-white focus:ring-1 focus:ring-gray-900/10"
            }`}
          />
          {validationErrors.phone && (
            <span className="text-red-400 text-sm font-light mt-2">
              {validationErrors.phone}
            </span>
          )}
        </label>
        {/* Password */}
        <label className="block mb-5">
          <span className="block mb-2 font-semibold text-gray-700 dark:text-slate-200 text-sm">
            Password
          </span>
          <div className="relative flex items-center gap-2">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={onChange}
              placeholder="Create a strong password"
              className={`w-full px-4 py-3 border text-base transition-all duration-200 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 ${
                validationErrors.password
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-gray-300 dark:border-slate-700 focus:border-gray-900 dark:focus:border-white focus:ring-1 focus:ring-gray-900/10"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 text-gray-500 dark:text-slate-400 text-sm font-light hover:text-gray-700 dark:hover:text-slate-200 transition-all duration-200"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {showPassword ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                )}
              </svg>
            </button>
          </div>
          {validationErrors.password && (
            <span className="text-red-400 text-sm font-light mt-2">
              {validationErrors.password}
            </span>
          )}
          {!validationErrors.password && (
            <span className="text-gray-500 dark:text-slate-500 text-sm mt-2 block font-light">
              At least 8 characters
            </span>
          )}
        </label>
        {/* Confirm Password */}
        <label className="block mb-6">
          <span className="block mb-2 font-semibold text-gray-700 dark:text-slate-200 text-sm">
            Confirm Password
          </span>
          <div className="relative flex items-center gap-2">
            <input
              type={showConfirm ? "text" : "password"}
              name="confirm"
              value={form.confirm}
              onChange={onChange}
              placeholder="Re-enter your password"
              className={`w-full px-4 py-3 border text-base transition-all duration-200 bg-gray-100 dark:bg-slate-800/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 font-light focus:outline-none focus:bg-gray-50 dark:focus:bg-slate-800 ${
                validationErrors.confirm
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-gray-300 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 text-gray-500 dark:text-slate-400 text-sm font-light hover:text-gray-700 dark:hover:text-slate-200 transition-all duration-200"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {showConfirm ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                )}
              </svg>
            </button>
          </div>
          {validationErrors.confirm && (
            <span className="text-red-400 text-sm font-light mt-2">
              {validationErrors.confirm}
            </span>
          )}
        </label>
        {/* Terms Checkbox */}
        <div className="flex items-start gap-4 my-6 px-4 py-4 bg-gray-100 dark:bg-slate-800/30 border border-gray-200 dark:border-slate-700/50 hover:border-gray-300 dark:hover:border-slate-600 transition-all">
          <input
            type="checkbox"
            name="agreeToTerms"
            checked={form.agreeToTerms}
            onChange={onChange}
            id="terms-checkbox"
            className="w-4 h-4 mt-0.5 cursor-pointer flex-shrink-0 accent-blue-500"
          />
          <label
            htmlFor="terms-checkbox"
            className="text-sm font-light text-gray-600 dark:text-slate-300 cursor-pointer leading-relaxed"
          >
            I agree to the{" "}
            <Link
              to="/terms"
              target="_blank"
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              Terms of Service and Privacy Policy
            </Link>
          </label>
        </div>
        {validationErrors.terms && (
          <span className="text-red-400 text-sm font-light -mt-4 mb-4">
            {validationErrors.terms}
          </span>
        )}
        {/* Submit Button */}
        <button
          className="w-full px-6 py-3 bg-blue-600 dark:bg-white text-white dark:text-slate-900 text-base font-medium shadow-lg hover:shadow-xl hover:bg-blue-700 dark:hover:bg-slate-50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={loading}
          type="submit"
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>
        {/* Footer */}
        <div className="text-center mt-6 pt-6 border-t border-gray-200 dark:border-slate-700/50 text-gray-600 dark:text-slate-400 text-sm">
          <p className="font-light">
            Already have an account?{" "}
            <Link
              to="/signin"
              className="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-500 dark:hover:text-blue-300 hover:underline transition-all"
            >
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default SignUp;

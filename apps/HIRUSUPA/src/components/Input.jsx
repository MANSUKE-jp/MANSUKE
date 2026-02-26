import React from 'react';
import { motion } from 'framer-motion';

const Input = ({
  label,
  subText,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  className = ""
}) => {
  return (
    <div className={`w-full mb-6 ${className}`}>
      {label && (
        <label className="block text-slate-800 font-bold text-lg mb-1">
          {label}
        </label>
      )}

      {subText && (
        <p className="text-sm text-slate-500 mb-3">
          {subText}
        </p>
      )}

      <motion.div
        initial={false}
        animate={error ? { x: [-5, 5, -5, 5, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`
            w-full px-4 py-3 rounded-xl border-2 
            bg-slate-50 text-slate-800 placeholder-slate-400
            transition-all duration-200
            focus:bg-white focus:outline-none focus:ring-0
            ${error 
              ? 'border-red-400 focus:border-red-500' 
              : 'border-slate-200 focus:border-blue-500'
            }
          `}
        />
      </motion.div>

      {error && (
        <p className="text-red-500 text-sm mt-1 ml-1 font-medium">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;
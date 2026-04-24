import React from "react";

interface ModalProps {
  children: React.ReactNode;
}

const Modal = ({ children }: ModalProps) => (
  <div className="modal-overlay">
    <div className="modal">{children}</div>
  </div>
);

export default Modal;

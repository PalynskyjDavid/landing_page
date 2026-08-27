package apperror

import (
	"errors"
	"fmt"
	"net/http"
)

type Error struct {
	Status  int
	Code    string
	Message string
	Err     error
}

func (e *Error) Error() string {
	if e == nil {
		return "<nil>"
	}
	if e.Err == nil {
		return fmt.Sprintf("%s (%s)", e.Message, e.Code)
	}

	return fmt.Sprintf("%s (%s): %v", e.Message, e.Code, e.Err)
}

func (e *Error) Unwrap() error {
	if e == nil {
		return nil
	}

	return e.Err
}

func New(status int, code string, message string, err error) *Error {
	return &Error{
		Status:  status,
		Code:    code,
		Message: message,
		Err:     err,
	}
}

func BadRequest(code string, message string, err error) *Error {
	return New(http.StatusBadRequest, code, message, err)
}

func Internal(code string, message string, err error) *Error {
	return New(http.StatusInternalServerError, code, message, err)
}

func From(err error) *Error {
	if err == nil {
		return nil
	}

	var appErr *Error
	if errors.As(err, &appErr) {
		return appErr
	}

	return Internal("internal_error", "Internal server error.", err)
}

// Refactor later.

package apperror

import (
	"errors"
	"fmt"
	"net/http"
)

// HTTP status code goes into the header,
// custom code (FE), message (client) and an optional wrapped error (real/original  error).
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
	return fmt.Sprintf("Status: %d, Code: %s, Message: %s", e.Status, e.Code, e.Message)
}

// makes "errors.Is(appErr, dbErr)" return true if appErr wraps dbErr. Basically returns original error.
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

func Conflict(code string, message string, err error) *Error {
	return New(http.StatusConflict, code, message, err)
}

func Internal(code string, message string, err error) *Error {
	return New(http.StatusInternalServerError, code, message, err)
}

// Converts any error to *Error. If it's already an *Error, it returns it as is. Otherwise, it wraps it in a generic internal error.
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
